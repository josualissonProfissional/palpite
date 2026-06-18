"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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
import { useLiveMatches } from "@/hooks/use-live-matches";
import { LiveBoard } from "@/components/palpite/live-board";
import { LiveRanking } from "@/components/palpite/live-ranking";
import { ShareGroupSummary } from "@/components/palpite/share-group-summary";
import { SharePredictions, type SharePrediction } from "@/components/palpite/share-predictions";

const statusCopy: Record<Match["status"], string> = {
  live: "Ao vivo",
  scheduled: "Aberto",
  finished: "Finalizado",
  locked: "Bloqueado",
};

const scoreStatusCopy: Record<NonNullable<Match["scoreStatus"]>, string> = {
  pending: "Pendente",
  correct: "Acertou",
  partial: "Parcial",
  wrong: "Errou",
  inverse_penalty: "Errou",
};

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
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Recife",
  }).format(new Date(value));
}

function tomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateKey(tomorrow);
}

function yesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateKey(yesterday);
}

function scoreOutcome(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
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
      ? "Você cravou o placar do jogo."
      : isDrawHit
        ? "Você acertou que o jogo terminaria empatado."
        : isOutcomeHit
          ? "Você acertou quem venceu a partida."
          : null,
    badgeLabel: isExactScore
      ? "Placar exato"
      : isDrawHit
        ? "Empate"
        : isOutcomeHit
          ? "Vitória"
          : scoreStatusCopy[scoreStatus],
  };
}

function MatchGrid({
  matches,
  groupId,
  emptyTitle,
  emptyDescription,
}: {
  matches: Match[];
  groupId?: string;
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
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} groupId={groupId} />
      ))}
    </div>
  );
}

export function MatchList({
  matches,
  groupId,
  groupName = "Meu bolao",
}: {
  matches: Match[];
  groupId?: string;
  groupName?: string;
}) {
  const { matches: liveMatches, connected } = useLiveMatches(matches);
  const currentLiveMatch = liveMatches.find((match) => match.status === "live");

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
      <LiveMatchFloatingPopup match={currentLiveMatch} />
      <Tabs defaultValue="games" className="gap-5">
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
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">
              <TabsTrigger value="today" className="h-9 px-3">
                Jogos de hoje
                <Badge variant="secondary">{matchesByDate.today.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="past" className="h-9 px-3">
                Jogos passados
                <Badge variant="secondary">{matchesByDate.past.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="tomorrow" className="h-9 px-3">
                Jogos de amanha
                <Badge variant="secondary">{matchesByDate.tomorrow.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today">
              <MatchGrid
                matches={matchesByDate.today}
                groupId={groupId}
                emptyTitle="Nenhum jogo hoje"
                emptyDescription="Quando houver jogo marcado para hoje, ele aparece aqui."
              />
            </TabsContent>
            <TabsContent value="past">
              <MatchGrid
                matches={matchesByDate.past}
                groupId={groupId}
                emptyTitle="Nenhum jogo passado"
                emptyDescription="Os jogos finalizados ou com data anterior aparecem aqui."
              />
            </TabsContent>
            <TabsContent value="tomorrow">
              <MatchGrid
                matches={matchesByDate.tomorrow}
                groupId={groupId}
                emptyTitle="Nenhum jogo amanha"
                emptyDescription="Quando houver jogo marcado para amanha, ele aparece aqui."
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="mine">
          <MyPredictionsPanel matches={liveMatches} groupName={groupName} />
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

function LiveMatchFloatingPopup({ match }: { match?: Match }) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 16, y: 120 });
  const [dragging, setDragging] = useState(false);
  const [closedMatchId, setClosedMatchId] = useState<string | null>(null);
  const status = match?.scoreStatus ?? "pending";
  const visual = livePopupStatus[status];
  const highlight = match ? getPredictionHighlight(match) : null;

  const statusTitle = useMemo(() => {
    if (!highlight?.title) return visual.title;
    return highlight.title;
  }, [highlight?.title, visual.title]);

  useEffect(() => {
    function placePopup() {
      const width = popupRef.current?.offsetWidth ?? 336;
      const height = popupRef.current?.offsetHeight ?? 230;
      setPosition({
        x: Math.max(8, window.innerWidth - width - 20),
        y: Math.max(84, window.innerHeight - height - 24),
      });
    }

    placePopup();
    window.addEventListener("resize", placePopup);
    return () => window.removeEventListener("resize", placePopup);
  }, [match?.id]);

  if (!match || closedMatchId === match.id) return null;

  const points = match.points ?? 0;
  const hasPrediction =
    typeof match.predictedHome === "number" && typeof match.predictedAway === "number";

  function clampPosition(nextX: number, nextY: number) {
    const width = popupRef.current?.offsetWidth ?? 336;
    const height = popupRef.current?.offsetHeight ?? 230;
    return {
      x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(72, nextY), Math.max(72, window.innerHeight - height - 8)),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
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
    if (!dragging) return;
    const next = clampPosition(
      event.clientX - dragOffsetRef.current.x,
      event.clientY - dragOffsetRef.current.y,
    );
    setPosition(next);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={popupRef}
      className={`fixed z-40 w-[min(calc(100vw-1rem),21rem)] rounded-2xl border p-3 backdrop-blur-xl transition-shadow ${visual.border}`}
      style={{ left: position.x, top: position.y }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`mb-3 flex cursor-grab touch-none select-none items-center justify-between gap-3 ${dragging ? "cursor-grabbing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-red-600 shadow-[0_0_16px_rgba(220,38,38,0.9)]" />
          </span>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
            Ao vivo
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 rounded-full"
          aria-label="Fechar placar ao vivo"
          onClick={() => setClosedMatchId(match.id)}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 space-y-1 text-left">
            <TeamFlag team={match.home} size="sm" className="justify-start" />
            <p className="truncate text-xs font-bold">{match.home.shortName}</p>
          </div>
          <div className="rounded-xl bg-slate-950 px-3 py-2 text-center text-lg font-black text-white shadow-lg shadow-red-950/20 ring-2 ring-red-400/45">
            {match.homeScore ?? "-"} : {match.awayScore ?? "-"}
          </div>
          <div className="min-w-0 space-y-1 text-right">
            <TeamFlag team={match.away} size="sm" className="justify-end" />
            <p className="truncate text-xs font-bold">{match.away.shortName}</p>
          </div>
        </div>

        <div className={`rounded-xl border p-3 ${visual.panel}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">{statusTitle}</p>
              <p className="text-xs opacity-80">{highlight?.description ?? visual.detail}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${visual.badge}`}>
              {highlight?.badgeLabel ?? scoreStatusCopy[status]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-white/60 bg-white/65 p-2 dark:border-white/10 dark:bg-slate-950/45">
            <p className="font-medium text-muted-foreground">Seu palpite</p>
            <p className="text-base font-black tabular-nums">
              {hasPrediction ? `${match.predictedHome} x ${match.predictedAway}` : "--"}
            </p>
          </div>
          <div className="rounded-lg border border-white/60 bg-white/65 p-2 text-right dark:border-white/10 dark:bg-slate-950/45">
            <p className="font-medium text-muted-foreground">Pontos</p>
            <p className="text-base font-black tabular-nums">
              {points > 0 ? "+" : ""}
              {points}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyPredictionsPanel({ matches, groupName }: { matches: Match[]; groupName: string }) {
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

  const shareData: SharePrediction[] = predictions.map((match) => ({
    home: match.home.shortName,
    away: match.away.shortName,
    predictedHome: match.predictedHome as number,
    predictedAway: match.predictedAway as number,
    resultHome: match.homeScore,
    resultAway: match.awayScore,
    matchStatus: match.status,
    status: match.scoreStatus,
    points: match.points,
  }));

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
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CalendarCheckIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Acertou</p>
              <p className="text-2xl font-semibold">{correct}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              <XCircleIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Errou</p>
              <p className="text-2xl font-semibold">{wrong}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <TrophyIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pontos</p>
              <p className="text-2xl font-semibold">{totalPoints}</p>
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
        <div className="grid gap-3">
          {visible.map((match) => (
            <PredictionSummaryCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionSummaryCard({ match }: { match: Match }) {
  const points = match.points ?? 0;
  const highlight = getPredictionHighlight(match);
  const HighlightIcon = highlight.Icon;

  return (
    <Card
      className={`${
        highlight.isExactScore
          ? "palpite-exact-prediction-card border-transparent bg-amber-50/90 shadow-lg ring-0 dark:bg-amber-950/25"
          : highlight.isOutcomeHit
            ? "border-emerald-300/80 bg-emerald-50/90 shadow-md shadow-emerald-950/10 ring-1 ring-emerald-300/50 dark:border-emerald-400/30 dark:bg-emerald-950/25 dark:ring-emerald-400/25"
            : "border-white/70 bg-white/86 shadow-sm dark:border-white/10 dark:bg-slate-950/70"
      }`}
    >
      <CardHeader className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle className="text-sm">
            {match.home.shortName} x {match.away.shortName}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{match.date}</p>
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
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-2">
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
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Seu palpite</span>
            <span className="font-semibold">
              {match.predictedHome} x {match.predictedAway}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Resultado</span>
            <span className="font-semibold">
              {match.homeScore ?? "-"} x {match.awayScore ?? "-"}
            </span>
          </div>
          {match.scoreReason ? (
            <p className="text-sm text-muted-foreground">{match.scoreReason}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Aguardando resultado.</p>
          )}
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-center text-sm font-semibold text-white ${
            highlight.isExactScore
              ? "bg-amber-500 shadow-md shadow-amber-500/30"
              : highlight.isOutcomeHit
                ? "bg-emerald-600 shadow-md shadow-emerald-600/25"
                : "bg-slate-950"
          }`}
        >
          {points > 0 ? "+" : ""}
          {points} pts
        </div>
      </CardContent>
    </Card>
  );
}

function MatchCard({ match, groupId }: { match: Match; groupId?: string }) {
  const isLocked =
    match.status === "locked" || match.status === "live" || match.status === "finished";
  const [prediction, setPrediction] = useState({
    home: match.predictedHome ?? 0,
    away: match.predictedAway ?? 0,
  });
  const isLive = match.status === "live";
  const highlight = getPredictionHighlight(match);
  const HighlightIcon = highlight.Icon;

  return (
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
            {statusCopy[match.status]}
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
          {match.scoreReason ? (
            <div className="rounded-lg border bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-slate-950/60">
              <span className="font-semibold">{match.scoreReason}</span>
              {typeof match.points === "number" ? (
                <span className="ml-2 text-muted-foreground">
                  {match.points > 0 ? "+" : ""}
                  {match.points} pts
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {match.lockLabel}
            </span>
            <SavePredictionButton
              disabled={isLocked}
              groupId={groupId}
              matchId={match.id}
              predictedHomeScore={prediction.home}
              predictedAwayScore={prediction.away}
              scoreStatus={match.scoreStatus}
            />
          </div>
        </CardContent>
      </Card>
    </MagicCard>
  );
}
