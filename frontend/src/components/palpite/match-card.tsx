"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import confetti from "canvas-confetti";
import { gsap } from "gsap";
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarOffIcon,
  ClockIcon,
  CircleCheckIcon,
  HandshakeIcon,
  ListChecksIcon,
  LockIcon,
  RadioIcon,
  SparklesIcon,
  TimerIcon,
  TrophyIcon,
  type LucideIcon,
  UsersIcon,
  XIcon,
  XCircleIcon,
} from "lucide-react";
import { EmptyState } from "@/components/palpite/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicCard } from "@/components/ui/magic-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Match } from "@/lib/palpite-data";
import { TeamFlag } from "@/components/palpite/team-flag";
import { PredictionStepper } from "@/components/palpite/prediction-stepper";
import { SavePredictionButton } from "@/components/palpite/save-prediction-button";
import { useLiveMatches, type LiveGoalEvent } from "@/hooks/use-live-matches";
import { LiveBoard } from "@/components/palpite/live-board";
import { LiveRanking } from "@/components/palpite/live-ranking";
import { ShareGroupSummary } from "@/components/palpite/share-group-summary";
import { SharePredictions } from "@/components/palpite/lazy";
import type { SharePrediction } from "@/components/palpite/lazy";
import { scoreStatusLabel } from "@/lib/score-status-copy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { countryFlag } from "@/lib/palpite-data";

const exactScoreConfettiFired = new Set<string>();
const goalAnimationMs = 4200;

type GoalSide = "home" | "away";

type GoalAnimationEvent = {
  id: number;
  matchId: string;
  teamName: string;
  home: Match["home"];
  away: Match["away"];
  side: GoalSide;
  homeScore: number;
  awayScore: number;
};

const statusCopy: Record<Match["status"], string> = {
  live: "Ao vivo",
  scheduled: "Aberto",
  finished: "Finalizado",
  locked: "Bloqueado",
  suspended: "Suspenso",
};

function isAwaitingLiveScore(match: Match) {
  return match.status === "live" && (typeof match.homeScore !== "number" || typeof match.awayScore !== "number");
}

const livePopupStatus = {
  correct: {
    border: "palpite-exact-prediction-card border-transparent bg-amber-50/95 shadow-2xl shadow-amber-950/20 dark:bg-amber-950/35",
    badge: "bg-amber-500 text-white shadow-sm shadow-amber-500/40",
    panel: "border-amber-300/80 bg-amber-100/85 text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100",
    title: "Placar exato!",
    detail: "Voce esta cravando o placar.",
  },
  partial: {
    border: "border-emerald-300/80 bg-emerald-50/95 shadow-2xl shadow-emerald-950/15 ring-1 ring-emerald-300/50 dark:border-emerald-400/30 dark:bg-emerald-950/35 dark:ring-emerald-400/25",
    badge: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30",
    panel: "border-emerald-300/80 bg-emerald-100/85 text-emerald-950 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-100",
    title: "Palpite batendo!",
    detail: "Voce esta acertando o caminho do jogo.",
  },
  wrong: {
    border: "border-rose-300/80 bg-rose-50/95 shadow-2xl shadow-rose-950/15 ring-1 ring-rose-300/50 dark:border-rose-400/30 dark:bg-rose-950/35 dark:ring-rose-400/25",
    badge: "bg-rose-600 text-white shadow-sm shadow-rose-600/30",
    panel: "border-rose-300/80 bg-rose-100/85 text-rose-950 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-100",
    title: "Palpite em risco",
    detail: "O resultado atual nao favorece seu palpite.",
  },
  inverse_penalty: {
    border: "border-rose-300/80 bg-rose-50/95 shadow-2xl shadow-rose-950/15 ring-1 ring-rose-300/50 dark:border-rose-400/30 dark:bg-rose-950/35 dark:ring-rose-400/25",
    badge: "bg-rose-700 text-white shadow-sm shadow-rose-700/30",
    panel: "border-rose-300/80 bg-rose-100/85 text-rose-950 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-100",
    title: "Placar invertido",
    detail: "O placar esta contra o seu palpite.",
  },
  pending: {
    border: "border-sky-300/80 bg-white/95 shadow-2xl shadow-slate-950/15 ring-1 ring-sky-300/45 dark:border-sky-400/30 dark:bg-slate-950/88 dark:ring-sky-400/20",
    badge: "bg-sky-600 text-white shadow-sm shadow-sky-600/30",
    panel: "border-sky-300/80 bg-sky-100/80 text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/10 dark:text-sky-100",
    title: "Acompanhando ao vivo",
    detail: "O jogo esta rolando agora.",
  },
} satisfies Record<NonNullable<Match["scoreStatus"]>, {
  border: string;
  badge: string;
  panel: string;
  title: string;
  detail: string;
}>;

function dateKey(value: Date | string) {
  const d = new Date(value);
  d.setHours(d.getHours() - 6);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Recife",
  }).format(d);
}

function tomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setHours(tomorrow.getHours() - 6);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateKey(tomorrow);
}

function yesterdayKey() {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 6);
  yesterday.setDate(yesterday.getDate() - 1);
  return dateKey(yesterday);
}

function scoreOutcome(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function getPredictionLockTime(match: Match, lockPredictionMinutesBefore: number) {
  return new Date(match.dateTime).getTime() - lockPredictionMinutesBefore * 60_000;
}

function useNowTick() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const timeout = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  return now;
}

type PredictionHighlight = {
  isExactScore: boolean;
  isOutcomeHit: boolean;
  isDrawHit: boolean;
  Icon: LucideIcon;
  title: string | null;
  description: string | null;
  badgeLabel: string;
};

function getPredictionHighlight(match: Match): PredictionHighlight {
  const scoreStatus = match.scoreStatus ?? "pending";
  const hasResult =
    typeof match.homeScore === "number" &&
    typeof match.awayScore === "number" &&
    typeof match.predictedHome === "number" &&
    typeof match.predictedAway === "number";
  const resultOutcome = hasResult ? scoreOutcome(match.homeScore as number, match.awayScore as number) : null;
  const predictedOutcome = hasResult ? scoreOutcome(match.predictedHome as number, match.predictedAway as number) : null;
  const isExactScore = scoreStatus === "correct";
  const isOutcomeHit = scoreStatus === "partial" && resultOutcome === predictedOutcome;
  const isDrawHit = isOutcomeHit && resultOutcome === "draw";
  const isFinished = match.status === "finished";

  return {
    isExactScore,
    isOutcomeHit,
    isDrawHit,
    Icon: isExactScore ? SparklesIcon : isDrawHit ? HandshakeIcon : CircleCheckIcon,
    title: isExactScore
      ? "Placar exato!"
      : isDrawHit
        ? "Empate acertado!"
        : isOutcomeHit
          ? "Vencedor acertado!"
          : null,
    description: isExactScore
      ? isFinished
        ? "Você cravou o placar do jogo."
        : "Você está cravando o placar no momento."
      : isDrawHit
        ? isFinished
          ? "Você acertou que o jogo terminaria empatado."
          : "Você está acertando o empate no momento."
        : isOutcomeHit
          ? isFinished
            ? "Você acertou quem venceu a partida."
            : "Você está acertando o caminho do jogo."
          : null,
    badgeLabel: isExactScore
      ? match.status === "finished"
        ? "Placar exato"
        : "Acertando"
      : isDrawHit
        ? match.status === "finished"
          ? "Empate"
          : "Acertando"
        : isOutcomeHit
          ? match.status === "finished"
            ? "Vitória"
            : "Acertando"
          : scoreStatusLabel(scoreStatus, match.status),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fireExactScoreConfetti(card: HTMLDivElement | null) {
  const rect = card?.getBoundingClientRect();
  const origin = rect
    ? {
        x: clamp((rect.left + rect.width / 2) / window.innerWidth, 0.08, 0.92),
        y: clamp((rect.top + rect.height / 2) / window.innerHeight, 0.12, 0.88),
      }
    : { x: 0.5, y: 0.5 };

  void confetti({
    particleCount: 90,
    spread: 72,
    startVelocity: 42,
    decay: 0.9,
    scalar: 0.95,
    ticks: 220,
    origin,
    colors: ["#2563eb", "#f97316", "#16a34a", "#f59e0b", "#dc2626", "#ffffff"],
    disableForReducedMotion: true,
    zIndex: 60,
  });
}

function fireGoalConfetti(side: GoalSide) {
  const originX = side === "home" ? 0.36 : 0.64;

  void confetti({
    particleCount: 140,
    spread: 86,
    startVelocity: 48,
    decay: 0.9,
    scalar: 1,
    ticks: 220,
    origin: { x: originX, y: 0.58 },
    colors: ["#22c55e", "#38bdf8", "#facc15", "#f97316", "#ffffff"],
    disableForReducedMotion: true,
    zIndex: 90,
  });
}

function GoalCelebrationOverlay({
  event,
  onDone,
}: {
  event: GoalAnimationEvent | null;
  onDone: () => void;
}) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const netRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!event) return;

    const scene = sceneRef.current;
    const ball = ballRef.current;
    const net = netRef.current;
    const text = textRef.current;
    const score = scoreRef.current;
    if (!scene || !ball || !net || !text || !score) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doneTimer = window.setTimeout(onDone, goalAnimationMs);
    fireGoalConfetti(event.side);

    const ctx = gsap.context(() => {
      gsap.set(scene, { autoAlpha: 1 });
      gsap.set(ball, {
        x: event.side === "home" ? -430 : 430,
        y: 62,
        scale: 0.72,
        rotate: event.side === "home" ? -130 : 130,
        autoAlpha: 1,
      });
      gsap.set(net, { scaleX: 1, scaleY: 1, rotate: 0, transformOrigin: "50% 58%" });
      gsap.set([text, score], { autoAlpha: 0, scale: 0.72, y: 28 });

      if (reducedMotion) {
        gsap.set([text, score], { autoAlpha: 1, scale: 1, y: 0 });
        gsap.to(scene, { autoAlpha: 0, duration: 0.25, delay: 2.4 });
        return;
      }

      const tl = gsap.timeline();
      tl.to(ball, {
        x: 0,
        y: -12,
        scale: 1.18,
        rotate: event.side === "home" ? 720 : -720,
        duration: 0.78,
        ease: "power3.out",
      })
        .to(
          net,
          {
            scaleX: 1.2,
            scaleY: 0.86,
            rotate: event.side === "home" ? 1.5 : -1.5,
            duration: 0.12,
            yoyo: true,
            repeat: 5,
            ease: "power1.inOut",
          },
          "-=0.12",
        )
        .to(
          text,
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.34,
            ease: "back.out(2.2)",
          },
          "-=0.26",
        )
        .to(
          score,
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.28,
            ease: "power2.out",
          },
          "-=0.14",
        )
        .to([ball, text, score], {
          autoAlpha: 0,
          y: "-=20",
          duration: 0.34,
          delay: 1.45,
          ease: "power2.in",
        })
        .to(scene, { autoAlpha: 0, duration: 0.22 }, "-=0.12");
    }, scene);

    return () => {
      window.clearTimeout(doneTimer);
      ctx.revert();
    };
  }, [event, onDone]);

  if (!event) return null;

  return (
    <div
      ref={sceneRef}
      className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-slate-950/45 px-4 opacity-0 backdrop-blur-[2px]"
      aria-live="assertive"
      role="status"
    >
      <div className="relative grid w-[min(92vw,34rem)] place-items-center">
        <div
          ref={netRef}
          className="h-44 w-72 rounded-lg border-[5px] border-white bg-[linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] bg-[size:24px_24px] shadow-2xl shadow-slate-950/45 sm:h-56 sm:w-96"
        />
        <div
          ref={ballRef}
          className="absolute text-6xl drop-shadow-[0_12px_20px_rgba(15,23,42,.45)] sm:text-7xl"
          aria-hidden="true"
        >
          ⚽
        </div>
        <div className="absolute top-[68%] grid justify-items-center gap-2 text-center">
          <div
            ref={textRef}
            className="font-heading text-6xl font-black leading-none text-white drop-shadow-[0_8px_18px_rgba(15,23,42,.75)] sm:text-8xl"
          >
            GOOOL!
          </div>
          <div
            ref={scoreRef}
            className="grid gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-xl sm:text-base"
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <TeamFlag
                team={event.home}
                size="sm"
                className={`justify-start ${event.side === "home" ? "rounded-lg bg-emerald-100 p-1 ring-2 ring-emerald-500" : ""}`}
              />
              <span className="text-base tabular-nums sm:text-lg">
                {event.homeScore} x {event.awayScore}
              </span>
              <TeamFlag
                team={event.away}
                size="sm"
                className={`justify-end ${event.side === "away" ? "rounded-lg bg-emerald-100 p-1 ring-2 ring-emerald-500" : ""}`}
              />
            </div>
            <span>{event.teamName} fez gol</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function useIsElementVisible<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) {
      setVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.45, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, visible };
}

function useExactScoreConfetti({
  cardRef,
  enabled,
  isExactScore,
  fireKey,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  isExactScore: boolean;
  fireKey: string;
}) {
  useEffect(() => {
    if (!enabled || !isExactScore || exactScoreConfettiFired.has(fireKey)) return;

    exactScoreConfettiFired.add(fireKey);
    fireExactScoreConfetti(cardRef.current);
  }, [cardRef, enabled, fireKey, isExactScore]);
}

function MatchGrid({
  matches,
  groupId,
  confettiEnabled,
  lockPredictionMinutesBefore,
  emptyTitle,
  emptyDescription,
}: {
  matches: Match[];
  groupId?: string;
  confettiEnabled: boolean;
  lockPredictionMinutesBefore: number;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (matches.length === 0) {
    return (
      <EmptyState
        icon={CalendarOffIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {matches.map((match) => (
        <div key={match.id} id={`match-${match.id}`} className="scroll-mt-24">
          <MatchCard
            match={match}
            groupId={groupId}
            confettiEnabled={confettiEnabled}
            lockPredictionMinutesBefore={lockPredictionMinutesBefore}
          />
        </div>
      ))}
    </div>
  );
}

export function MatchList({
  matches,
  groupId,
  groupName = "Meu bolao",
  lockPredictionMinutesBefore = 10,
}: {
  matches: Match[];
  groupId?: string;
  groupName?: string;
  lockPredictionMinutesBefore?: number;
}) {
  const [activeTab, setActiveTab] = useState("games");
  const [goalEvent, setGoalEvent] = useState<GoalAnimationEvent | null>(null);

  const triggerGoalAnimation = useCallback((event: LiveGoalEvent) => {
    const match = matches.find((item) => item.id === event.matchId);
    if (!match) return;

    setGoalEvent({
      id: Date.now(),
      matchId: event.matchId,
      teamName: event.side === "home" ? match.home.shortName : match.away.shortName,
      home: match.home,
      away: match.away,
      side: event.side,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
    });
  }, [matches]);
  const closeGoalAnimation = useCallback(() => setGoalEvent(null), []);
  const { matches: liveMatches, connected } = useLiveMatches(matches, groupId, triggerGoalAnimation);
  const popupMatch =
    liveMatches.find((match) => match.status === "live") ??
    liveMatches.find((match) => match.status === "scheduled");
  const popupMode = popupMatch?.status === "live" ? "live" : "next";

  if (liveMatches.length === 0) {
    return (
      <EmptyState
        icon={CalendarOffIcon}
        title="Nenhum jogo encontrado"
        description="Os jogos da Copa 2026 aparecem aqui assim que a tabela for divulgada."
      />
    );
  }

  const today = dateKey(new Date());
  const tomorrow = tomorrowKey();
  const matchesByDate = {
    today: liveMatches.filter((match) => dateKey(match.dateTime) === today),
    tomorrow: liveMatches.filter((match) => dateKey(match.dateTime) === tomorrow),
    past: liveMatches.filter((match) => dateKey(match.dateTime) < today),
  };
  const defaultGamesTab =
    matchesByDate.today.length > 0
      ? "today"
      : matchesByDate.tomorrow.length > 0
        ? "tomorrow"
        : "past";

  return (
    <>
      <GoalCelebrationOverlay event={goalEvent} onDone={closeGoalAnimation} />
      <LiveMatchFloatingPopup match={popupMatch} mode={popupMode} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">
            <TabsTrigger value="games" className="h-9 px-3">
              <CalendarClockIcon className="size-4" />
              Jogos
            </TabsTrigger>
            <TabsTrigger value="mine" className="h-9 px-3">
              <ListChecksIcon className="size-4" />
              Meus palpites
            </TabsTrigger>
            <TabsTrigger value="geral" className="h-9 px-3">
              <UsersIcon className="size-4" />
              Geral
            </TabsTrigger>
          </TabsList>
          <Badge
            variant={connected ? "default" : "secondary"}
            className="gap-1"
            title={connected ? "Conectado ao placar ao vivo" : "Conectando ao placar ao vivo"}
          >
            <RadioIcon className={connected ? "size-3 animate-pulse" : "size-3"} />
            {connected ? "Ao vivo conectado" : "Conectando..."}
          </Badge>
        </div>

        <TabsContent value="games">
          <Tabs defaultValue={defaultGamesTab} className="gap-4">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:flex sm:w-fit sm:flex-wrap sm:justify-start">
              <TabsTrigger value="today" className="h-9 px-3">
                Hoje
                <Badge variant="secondary">{matchesByDate.today.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="past" className="h-9 px-3">
                Passados
                <Badge variant="secondary">{matchesByDate.past.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="tomorrow" className="h-9 px-3">
                Amanha
                <Badge variant="secondary">{matchesByDate.tomorrow.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today">
              <MatchGrid
                matches={matchesByDate.today}
                groupId={groupId}
                confettiEnabled={activeTab === "games"}
                lockPredictionMinutesBefore={lockPredictionMinutesBefore}
                emptyTitle="Nenhum jogo hoje"
                emptyDescription="Quando houver jogo marcado para hoje, ele aparece aqui."
              />
            </TabsContent>
            <TabsContent value="past">
              <MatchGrid
                matches={matchesByDate.past}
                groupId={groupId}
                confettiEnabled={activeTab === "games"}
                lockPredictionMinutesBefore={lockPredictionMinutesBefore}
                emptyTitle="Nenhum jogo passado"
                emptyDescription="Os jogos finalizados ou com data anterior aparecem aqui."
              />
            </TabsContent>
            <TabsContent value="tomorrow">
              <MatchGrid
                matches={matchesByDate.tomorrow}
                groupId={groupId}
                confettiEnabled={activeTab === "games"}
                lockPredictionMinutesBefore={lockPredictionMinutesBefore}
                emptyTitle="Nenhum jogo amanha"
                emptyDescription="Quando houver jogo marcado para amanha, ele aparece aqui."
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="mine">
          <MyPredictionsPanel
            matches={liveMatches}
            groupName={groupName}
            confettiEnabled={activeTab === "mine"}
          />
        </TabsContent>

        <TabsContent value="geral" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              Compartilhe ranking, palpites de todos ou os dois juntos.
            </p>
            <ShareGroupSummary groupId={groupId} groupName={groupName} />
          </div>
          <LiveRanking groupId={groupId} />
          <LiveBoard groupId={groupId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function LiveMatchFloatingPopup({ match, mode }: { match?: Match; mode: "live" | "next" }) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 16, y: 120 });
  const [dragging, setDragging] = useState(false);
  const [closedMatchId, setClosedMatchId] = useState<string | null>(null);
  const [isMobilePopup, setIsMobilePopup] = useState(false);
  const status = match?.scoreStatus ?? "pending";
  const visual = livePopupStatus[status];
  const highlight = match ? getPredictionHighlight(match) : null;
  const isLive = mode === "live";
  const waitingLiveScore = match ? isAwaitingLiveScore(match) : false;

  const statusTitle = useMemo(() => {
    if (!isLive && match) {
      const hasPrediction =
        typeof match.predictedHome === "number" &&
        typeof match.predictedAway === "number";
      return hasPrediction ? "Palpite salvo" : "Palpite pendente";
    }
    if (waitingLiveScore) return "Aguardando placar";
    if (!highlight?.title) return visual.title;
    return highlight.title;
  }, [highlight?.title, isLive, match, visual.title, waitingLiveScore]);

  useEffect(() => {
    function placePopup() {
      const width = popupRef.current?.offsetWidth ?? 336;
      const height = popupRef.current?.offsetHeight ?? 230;
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const offsetTop = viewport?.offsetTop ?? 0;
      const isMobile = viewportWidth < 640;
      setIsMobilePopup(isMobile);

      setPosition({
        x: isMobile
          ? Math.max(8, offsetLeft + viewportWidth - width - 10)
          : Math.max(8, offsetLeft + viewportWidth - width - 20),
        y: Math.max(76, offsetTop + viewportHeight - height - (isMobile ? 10 : 24)),
      });
    }

    placePopup();
    window.addEventListener("resize", placePopup);
    window.visualViewport?.addEventListener("resize", placePopup);
    window.visualViewport?.addEventListener("scroll", placePopup);

    return () => {
      window.removeEventListener("resize", placePopup);
      window.visualViewport?.removeEventListener("resize", placePopup);
      window.visualViewport?.removeEventListener("scroll", placePopup);
    };
  }, [match?.id, status, statusTitle]);

  if (!match || closedMatchId === match.id) return null;

  const matchId = match.id;
  const points = match.points ?? 0;
  const hasPrediction =
    typeof match.predictedHome === "number" && typeof match.predictedAway === "number";
  const statusDetail = !isLive
    ? hasPrediction
      ? "Seu palpite ja esta pronto para este jogo."
      : "Adicione seu palpite antes da bola rolar."
    : waitingLiveScore
      ? "O placar aparecerá aqui assim que o resultado for confirmado."
      : highlight?.description ?? visual.detail;
  const statusBadge = !isLive
    ? hasPrediction
      ? "Salvo"
      : "Sem palpite"
    : waitingLiveScore
      ? "Aguardando"
    : highlight?.badgeLabel ?? scoreStatusLabel(status, match.status);
  const headerLabel = isLive ? (waitingLiveScore ? "Ao vivo aguardando placar" : "Ao vivo") : "Proximo jogo";

  function clampPosition(nextX: number, nextY: number) {
    const width = popupRef.current?.offsetWidth ?? 300;
    const height = popupRef.current?.offsetHeight ?? 210;
    return {
      x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(72, nextY), Math.max(72, window.innerHeight - height - 8)),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isMobilePopup) return;
    if (event.button !== 0) return;
    const rect = popupRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (isMobilePopup) return;
    if (!dragging) return;
    const next = clampPosition(
      event.clientX - dragOffsetRef.current.x,
      event.clientY - dragOffsetRef.current.y,
    );
    setPosition(next);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (isMobilePopup) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function focusMatchCard() {
    document.getElementById(`match-${matchId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <div
      ref={popupRef}
      className={`fixed z-40 w-[min(calc(100vw-1rem),13.5rem)] rounded-xl border p-2 backdrop-blur-xl transition-shadow sm:w-[21rem] sm:rounded-2xl sm:p-3 ${visual.border}`}
      style={
        isMobilePopup
          ? { right: 10, bottom: 10 }
          : { left: position.x, top: position.y }
      }
      role="status"
      aria-live="polite"
    >
      <div
        className={`mb-1.5 flex cursor-grab touch-none select-none items-center justify-between gap-2 sm:mb-3 sm:gap-3 ${dragging ? "cursor-grabbing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5 sm:size-3">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                isLive ? "bg-red-500" : "bg-sky-500"
              }`}
            />
            <span
              className={`relative inline-flex size-3 rounded-full ${
                isLive
                  ? "bg-red-600 shadow-[0_0_16px_rgba(220,38,38,0.9)]"
                  : "bg-sky-600 shadow-[0_0_16px_rgba(2,132,199,0.75)]"
              }`}
            />
          </span>
          <span
            className={`text-[10px] font-black uppercase tracking-[0.16em] sm:text-xs sm:tracking-[0.18em] ${
              isLive ? "text-red-600 dark:text-red-300" : "text-sky-700 dark:text-sky-300"
            }`}
          >
            {headerLabel}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-5 rounded-full sm:size-7"
          aria-label="Fechar placar ao vivo"
          onClick={() => setClosedMatchId(match.id)}
        >
          <XIcon className="size-3 sm:size-4" />
        </Button>
      </div>

      <div className="space-y-1.5 sm:space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 space-y-1 text-left">
            <TeamFlag team={match.home} size="sm" className="justify-start" />
            <p className="truncate text-[10px] font-bold sm:text-xs">{match.home.shortName}</p>
          </div>
          <div
            className={`rounded-lg bg-slate-950 px-2 py-1 text-center text-sm font-black text-white shadow-lg sm:rounded-xl sm:px-3 sm:py-2 sm:text-lg ${
              isLive ? "shadow-red-950/20 ring-2 ring-red-400/45" : "shadow-sky-950/15 ring-2 ring-sky-400/35"
            }`}
          >
            {match.homeScore ?? "-"} : {match.awayScore ?? "-"}
          </div>
          <div className="min-w-0 space-y-1 text-right">
            <TeamFlag team={match.away} size="sm" className="justify-end" />
            <p className="truncate text-[10px] font-bold sm:text-xs">{match.away.shortName}</p>
          </div>
        </div>

        <div className={`rounded-lg border p-2 sm:rounded-xl sm:p-3 ${visual.panel}`}>
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div>
              <p className="text-[11px] font-black sm:text-sm">{statusTitle}</p>
              <p className="hidden text-[11px] opacity-80 sm:block sm:text-xs">{statusDetail}</p>
            </div>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black sm:px-2 sm:py-1 sm:text-xs ${visual.badge}`}>
              {statusBadge}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs sm:gap-2">
          <div className="rounded-lg border border-white/60 bg-white/65 p-1.5 dark:border-white/10 dark:bg-slate-950/45 sm:p-2">
            <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Palpite</p>
            <p className="text-xs font-black tabular-nums sm:text-base">
              {hasPrediction ? `${match.predictedHome} x ${match.predictedAway}` : "--"}
            </p>
          </div>
          <div className="rounded-lg border border-white/60 bg-white/65 p-1.5 text-right dark:border-white/10 dark:bg-slate-950/45 sm:p-2">
            <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Pts</p>
            <p className="text-xs font-black tabular-nums sm:text-base">
              {points > 0 ? "+" : ""}
              {points}
            </p>
          </div>
        </div>
        {!isLive && !hasPrediction ? (
          <Button size="sm" className="h-8 w-full text-xs" onClick={focusMatchCard}>
            Adicionar palpite
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MyPredictionsPanel({
  matches,
  groupName,
  confettiEnabled,
}: {
  matches: Match[];
  groupName: string;
  confettiEnabled: boolean;
}) {
  const [dayFilter, setDayFilter] = useState<"all" | "today" | "yesterday">("all");

  const predictions = matches.filter(
    (match) =>
      typeof match.predictedHome === "number" &&
      typeof match.predictedAway === "number",
  );
  const correct = predictions.filter((match) => match.scoreStatus === "correct").length;
  const wrong = predictions.filter(
    (match) => match.scoreStatus === "wrong" || match.scoreStatus === "inverse_penalty",
  ).length;
  const hasUnfinishedFeedback = predictions.some(
    (match) =>
      match.status !== "finished" &&
      (match.scoreStatus === "correct" ||
        match.scoreStatus === "partial" ||
        match.scoreStatus === "wrong" ||
        match.scoreStatus === "inverse_penalty"),
  );
  const correctLabel = hasUnfinishedFeedback ? "Acertando" : "Acertou";
  const wrongLabel = hasUnfinishedFeedback ? "Errando" : "Errou";
  const totalPoints = predictions.reduce((total, match) => total + (match.points ?? 0), 0);

  if (predictions.length === 0) {
    return (
      <EmptyState
        icon={ListChecksIcon}
        title="Nenhum palpite salvo"
        description="Salve um palpite em um jogo aberto para acompanhar sua pontuacao aqui."
      />
    );
  }

  const today = dateKey(new Date());
  const yesterday = yesterdayKey();
  const visible = predictions.filter((match) => {
    if (dayFilter === "today") return dateKey(match.dateTime) === today;
    if (dayFilter === "yesterday") return dateKey(match.dateTime) === yesterday;
    return true;
  });

  const shareData: SharePrediction[] = predictions.map(toSharePrediction);

  const filters: { key: typeof dayFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "today", label: "Hoje" },
    { key: "yesterday", label: "Ontem" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {predictions.length} palpites · {totalPoints} pts
        </p>
        <SharePredictions groupName={groupName} predictions={shareData} totalPoints={totalPoints} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={dayFilter === f.key ? "default" : "secondary"}
            onClick={() => setDayFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Card size="sm" className="border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <CardContent className="flex items-center gap-2 p-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CalendarCheckIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{correctLabel}</p>
              <p className="text-lg font-semibold leading-none">{correct}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <CardContent className="flex items-center gap-2 p-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              <XCircleIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{wrongLabel}</p>
              <p className="text-lg font-semibold leading-none">{wrong}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <CardContent className="flex items-center gap-2 p-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <TrophyIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">Pontos</p>
              <p className="text-lg font-semibold leading-none">{totalPoints}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ListChecksIcon}
          title="Nenhum palpite neste dia"
          description="Escolha outro filtro para ver seus palpites."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((match) => (
            <PredictionSummaryCard
              key={match.id}
              match={match}
              groupName={groupName}
              confettiEnabled={confettiEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function toSharePrediction(match: Match): SharePrediction {
  return {
    home: match.home.shortName,
    away: match.away.shortName,
    homeFlagUrl: match.home.logoUrl,
    awayFlagUrl: match.away.logoUrl,
    homeFlagHint: match.home.code !== "un" ? match.home.code : match.home.shortName,
    awayFlagHint: match.away.code !== "un" ? match.away.code : match.away.shortName,
    predictedHome: match.predictedHome as number,
    predictedAway: match.predictedAway as number,
    resultHome: match.homeScore,
    resultAway: match.awayScore,
    matchStatus: match.status,
    status: match.scoreStatus,
    points: match.points,
  };
}

function PredictionSummaryCard({
  match,
  groupName,
  confettiEnabled,
}: {
  match: Match;
  groupName: string;
  confettiEnabled: boolean;
}) {
  const points = match.points ?? 0;
  const highlight = getPredictionHighlight(match);
  const HighlightIcon = highlight.Icon;
  const { ref: cardRef, visible } = useIsElementVisible<HTMLDivElement>(
    confettiEnabled && highlight.isExactScore,
  );
  const sharePrediction = toSharePrediction(match);
  const pointsLabel = `${points > 0 ? "+" : ""}${points} pts`;

  useExactScoreConfetti({
    cardRef,
    enabled: confettiEnabled && visible,
    isExactScore: highlight.isExactScore,
    fireKey: `mine:${match.id}`,
  });

  return (
    <Card
      ref={cardRef}
      size="sm"
      className={`${
        highlight.isExactScore
          ? "palpite-exact-prediction-card border-transparent bg-amber-50/90 shadow-lg ring-0 dark:bg-amber-950/25"
          : highlight.isOutcomeHit
            ? "border-emerald-300/80 bg-emerald-50/90 shadow-md shadow-emerald-950/10 ring-1 ring-emerald-300/50 dark:border-emerald-400/30 dark:bg-emerald-950/25 dark:ring-emerald-400/25"
            : "border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70"
      }`}
    >
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">
              {match.home.shortName} x {match.away.shortName}
            </CardTitle>
            <p className="truncate text-xs text-muted-foreground">{match.date}</p>
          </div>
          <Badge
            variant={highlight.isExactScore || highlight.isOutcomeHit ? "default" : "secondary"}
            className={
              highlight.isExactScore
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                : highlight.isOutcomeHit
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
                  : undefined
            }
          >
            {highlight.badgeLabel}
          </Badge>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <TeamFlag team={match.home} size="sm" className="justify-start" />
          <div
            className={`rounded-lg px-2 py-1.5 text-center text-sm font-black tabular-nums text-white ${
              highlight.isExactScore ? "bg-amber-500" : highlight.isOutcomeHit ? "bg-emerald-600" : "bg-slate-950"
            }`}
          >
            {match.predictedHome} x {match.predictedAway}
          </div>
          <TeamFlag team={match.away} size="sm" className="justify-end" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2 text-xs">
          {highlight.title ? (
            <div
              className={`flex items-start gap-2 rounded-lg border p-2 ${
                highlight.isExactScore
                  ? "border-amber-300/80 bg-amber-100/80 text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100"
                  : "border-emerald-300/80 bg-emerald-100/80 text-emerald-950 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-100"
              }`}
            >
              <div
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                  highlight.isExactScore
                    ? "bg-amber-500 text-white shadow-sm shadow-amber-500/40"
                    : "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                }`}
              >
                <HighlightIcon className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold">{highlight.title}</p>
                <p className="text-[11px] opacity-80">{highlight.description}</p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Seu palpite</span>
            <span className="font-semibold">
              {match.predictedHome} x {match.predictedAway}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Resultado</span>
            <span className="font-semibold">
              {match.homeScore ?? "-"} x {match.awayScore ?? "-"}
            </span>
          </div>
          {match.scoreReason ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{match.scoreReason}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Aguardando resultado.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div
            className={`rounded-lg px-3 py-2 text-center text-sm font-semibold text-white ${
              highlight.isExactScore
                ? "bg-amber-500 shadow-md shadow-amber-500/30"
                : highlight.isOutcomeHit
                  ? "bg-emerald-600 shadow-md shadow-emerald-600/25"
                  : "bg-slate-950"
            }`}
          >
            {pointsLabel}
          </div>
          <SharePredictions
            groupName={groupName}
            predictions={[sharePrediction]}
            totalPoints={points}
            triggerLabel="Compartilhar"
            triggerClassName="h-8 px-2 text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PredictionDeadline({
  match,
  lockPredictionMinutesBefore,
  hasPrediction,
  now,
}: {
  match: Match;
  lockPredictionMinutesBefore: number;
  hasPrediction: boolean;
  now: number | null;
}) {
  const lockAt = getPredictionLockTime(match, lockPredictionMinutesBefore);
  const isMatchClosed = match.status === "locked" || match.status === "live" || match.status === "finished";
  const remaining = now === null ? null : lockAt - now;
  const isClosed = isMatchClosed || (remaining !== null && remaining <= 0);
  const isUrgent = remaining !== null && remaining > 0 && remaining <= 15 * 60_000;
  const isWarning = remaining !== null && remaining > 15 * 60_000 && remaining <= 60 * 60_000;

  const visual = isClosed
    ? hasPrediction
      ? "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-100"
      : "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-400/10 dark:text-rose-100"
    : isUrgent
      ? "border-red-300/80 bg-red-50 text-red-900 dark:border-red-300/30 dark:bg-red-400/10 dark:text-red-100"
      : isWarning
        ? "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100"
        : "border-white/70 bg-white/65 text-muted-foreground dark:border-white/10 dark:bg-slate-950/45";

  const label = isClosed
    ? hasPrediction
      ? "Seu palpite foi salvo"
      : "Não palpitou"
    : `${hasPrediction ? "Atualizar até" : "Aberto até"} ${
        now === null ? "carregando..." : formatCountdown(remaining ?? 0)
      }`;

  return (
    <div className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${visual}`}>
      {isClosed ? <LockIcon className="size-3.5 shrink-0" /> : <TimerIcon className="size-3.5 shrink-0" />}
      <span className="truncate tabular-nums">{label}</span>
    </div>
  );
}

function MatchCard({
  match,
  groupId,
  confettiEnabled,
  lockPredictionMinutesBefore,
}: {
  match: Match;
  groupId?: string;
  confettiEnabled: boolean;
  lockPredictionMinutesBefore: number;
}) {
  const now = useNowTick();
  const lockAt = getPredictionLockTime(match, lockPredictionMinutesBefore);
  const isTimeLocked = now !== null && lockAt <= now;
  const isLocked =
    match.status === "locked" || match.status === "live" || match.status === "finished" || isTimeLocked;
  const [prediction, setPrediction] = useState({
    home: match.predictedHome ?? 0,
    away: match.predictedAway ?? 0,
  });
  const isLive = match.status === "live";
  const waitingLiveScore = isAwaitingLiveScore(match);
  const hasPrediction = typeof match.predictedHome === "number" && typeof match.predictedAway === "number";
  const highlight = getPredictionHighlight(match);
  const HighlightIcon = highlight.Icon;
  const { ref: cardRef, visible } = useIsElementVisible<HTMLDivElement>(
    confettiEnabled && highlight.isExactScore,
  );

  useExactScoreConfetti({
    cardRef,
    enabled: confettiEnabled && visible,
    isExactScore: highlight.isExactScore,
    fireKey: `games:${match.id}`,
  });

  return (
    <div ref={cardRef} className="h-full">
      <MagicCard
        className={`h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
          highlight.isExactScore
            ? "palpite-exact-prediction-card"
            : highlight.isOutcomeHit
              ? "ring-1 ring-emerald-300/70 shadow-md shadow-emerald-950/10 dark:ring-emerald-400/30"
              : ""
        }`}
        gradientColor={
          highlight.isExactScore
            ? "rgba(245, 158, 11, 0.16)"
            : highlight.isOutcomeHit
              ? "rgba(16, 185, 129, 0.14)"
              : isLive
                ? "rgba(239, 68, 68, 0.14)"
                : "rgba(37, 99, 235, 0.12)"
        }
        gradientFrom={
          highlight.isExactScore
            ? "rgba(245, 158, 11, 0.86)"
            : highlight.isOutcomeHit
              ? "rgba(16, 185, 129, 0.82)"
              : isLive
                ? "rgba(239, 68, 68, 0.78)"
                : "rgba(37, 99, 235, 0.78)"
        }
        gradientTo={
          highlight.isExactScore
            ? "rgba(168, 85, 247, 0.58)"
            : highlight.isOutcomeHit
              ? "rgba(34, 197, 94, 0.56)"
              : isLive
                ? "rgba(251, 146, 60, 0.52)"
                : "rgba(14, 165, 233, 0.52)"
        }
      >
        <Card
          className={`h-full border-0 shadow-sm ring-0 backdrop-blur ${
            highlight.isExactScore
              ? "bg-amber-50/90 dark:bg-amber-950/25"
              : highlight.isOutcomeHit
                ? "bg-emerald-50/90 dark:bg-emerald-950/25"
                : "bg-white/86 dark:bg-slate-950/70"
          }`}
        >
          <CardHeader className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {match.date}
            </p>
            <p className="text-sm text-muted-foreground">{match.venue}</p>
          </div>
          <Badge
            className="gap-1"
            variant={match.status === "live" ? "destructive" : "secondary"}
          >
            {isLive ? (
              <RadioIcon className="size-3" />
            ) : isLocked ? (
              <LockIcon className="size-3" />
            ) : (
              <ClockIcon className="size-3" />
            )}
            {waitingLiveScore ? "Ao vivo aguardando placar" : match.status === "scheduled" && isLocked ? "Bloqueado" : statusCopy[match.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          {highlight.title ? (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 ${
                highlight.isExactScore
                  ? "border-amber-300/80 bg-amber-100/80 text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100"
                  : "border-emerald-300/80 bg-emerald-100/80 text-emerald-950 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-100"
              }`}
            >
              <div
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                  highlight.isExactScore
                    ? "bg-amber-500 text-white shadow-sm shadow-amber-500/40"
                    : "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                }`}
              >
                <HighlightIcon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-bold">{highlight.title}</p>
                <p className="text-xs opacity-80">{highlight.description}</p>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
            <TeamFlag team={match.home} showName className="justify-start" />
            <div
              className={`rounded-lg px-2 py-2 text-center text-base font-bold text-white transition-colors sm:px-3 sm:text-lg ${
                isLive
                  ? "bg-red-600 ring-2 ring-red-400/60 ring-offset-1 ring-offset-background animate-pulse"
                  : "bg-slate-950"
              }`}
            >
              {match.homeScore ?? "-"} : {match.awayScore ?? "-"}
            </div>
            <TeamFlag team={match.away} showName className="justify-end text-right" />
          </div>
          <PredictionStepper
            home={match.home}
            away={match.away}
            initialHome={match.predictedHome ?? 0}
            initialAway={match.predictedAway ?? 0}
            onChange={setPrediction}
            disabled={isLocked}
          />
          {match.goalSelections?.length ? (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/20 dark:bg-emerald-950/20 relative overflow-hidden">
              {(match.scoreStatus === "correct" || match.scoreStatus === "partial") && match.goalSelections?.some(s => s.scorerHit || s.assistHit) ? (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-emerald-400/10 pointer-events-none" />
              ) : null}
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-100"><CircleCheckIcon className="size-4" />Seus autores e assistências</p>
              <div className="grid gap-2">
                {match.goalSelections.map((selection) => {
                  const team = selection.teamId === match.home.id ? match.home : match.away;
                  const positions = { gk: "Goleiro", df: "Defesa", mf: "Meio-campo", fw: "Atacante" } as const;
                  const hasFeedback = typeof selection.scorerHit === "boolean";
                  const bothHit = hasFeedback && selection.scorerHit && selection.assistHit;
                  const ringClass = bothHit ? "ring-amber-400 shadow-lg shadow-amber-400/20 dark:ring-amber-300 dark:shadow-amber-300/10" : hasFeedback && (selection.scorerHit || selection.assistHit) ? "ring-emerald-400 dark:ring-emerald-500" : "";
                  return (
                    <div key={`${selection.teamId}-${selection.goalIndex}`} className={`flex items-center gap-3 rounded-lg bg-white/80 px-3 py-2.5 text-xs dark:bg-slate-950/50 ${ringClass}`}>
                      <Avatar className={`size-9 shrink-0 rounded-full ring-2 ${bothHit ? "ring-amber-400 dark:ring-amber-300" : hasFeedback && selection.scorerHit ? "ring-emerald-400" : "ring-emerald-200 dark:ring-emerald-500/30"}`}>
                        <AvatarImage src={selection.scorerPhotoUrl} alt={selection.scorerName} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] font-bold">
                          {countryFlag(team.shortName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{countryFlag(team.shortName)}</span>
                          <span className="truncate font-bold">{selection.scorerName}{selection.isOwnGoal ? " (contra)" : ""}</span>
                          {hasFeedback ? (
                            selection.scorerHit ? <CircleCheckIcon className="size-3.5 shrink-0 text-emerald-500" /> : <XCircleIcon className="size-3.5 shrink-0 text-red-400" />
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">{positions[selection.scorerPosition]}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            {selection.assistName ? (
                              <>
                                <Avatar className="size-4 rounded-full"><AvatarImage src={selection.assistPhotoUrl} alt={selection.assistName} /><AvatarFallback className="bg-slate-200 text-[8px] dark:bg-slate-700">{countryFlag(team.shortName)}</AvatarFallback></Avatar>
                                <span className="truncate">{selection.assistName}</span>
                                {hasFeedback ? (
                                  selection.assistHit ? <CircleCheckIcon className="size-3 shrink-0 text-emerald-500" /> : <XCircleIcon className="size-3 shrink-0 text-red-400" />
                                ) : null}
                              </>
                            ) : "Sem assistência"}
                          </span>
                        </div>
                      </div>
                      {bothHit ? <CircleCheckIcon className="size-10 shrink-0 text-amber-400 opacity-80" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {match.scoreReason ? (
            <div className="rounded-lg border bg-white/70 p-3 dark:border-white/10 dark:bg-slate-950/60">
              {(typeof match.scorePoints === "number" || typeof match.goalAssistPoints === "number") ? (
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">{match.scoreStatus === "correct" ? "🏆 Placar exato" : match.scoreStatus === "partial" ? "⚽ Acertou vencedor" : "Placar"}</span>
                    <span className="font-bold tabular-nums">{match.scorePoints && match.scorePoints > 0 ? "+" : ""}{match.scorePoints ?? 0} pts</span>
                  </p>
                  {typeof match.goalScorerPoints === "number" && match.goalScorerPoints > 0 ? (
                    <p className="flex justify-between"><span className="text-muted-foreground pl-3">Gols</span><span className="font-medium tabular-nums text-emerald-600">+{match.goalScorerPoints} pts</span></p>
                  ) : null}
                  {typeof match.goalAssistAssistPoints === "number" && match.goalAssistAssistPoints > 0 ? (
                    <p className="flex justify-between"><span className="text-muted-foreground pl-3">Assistências</span><span className="font-medium tabular-nums text-emerald-600">+{match.goalAssistAssistPoints} pts</span></p>
                  ) : null}
                  <p className="flex justify-between border-t pt-1.5 mt-0.5 border-slate-200 dark:border-slate-700">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-base tabular-nums">{match.points && match.points > 0 ? "+" : ""}{match.points ?? 0} pts</span>
                  </p>
                </div>
              ) : (
                <>
                  <span className="font-semibold">{match.scoreReason}</span>
                  {typeof match.points === "number" ? (
                    <span className="ml-2 text-muted-foreground">{match.points > 0 ? "+" : ""}{match.points} pts</span>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
          <div className="space-y-3">
            <PredictionDeadline
              match={match}
              lockPredictionMinutesBefore={lockPredictionMinutesBefore}
              hasPrediction={hasPrediction}
              now={now}
            />
            <SavePredictionButton
              disabled={isLocked}
              groupId={groupId}
              matchId={match.id}
              home={match.home}
              away={match.away}
              predictedHomeScore={prediction.home}
              predictedAwayScore={prediction.away}
              matchStatus={match.status}
              scoreStatus={match.scoreStatus}
              hasGoalSelections={Boolean(match.goalSelections?.length)}
              hasExistingPrediction={hasPrediction}
            />
          </div>
          </CardContent>
        </Card>
      </MagicCard>
    </div>
  );
}
