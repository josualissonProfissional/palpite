"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChartNoAxesColumnIncreasingIcon,
  CrownIcon,
  RadioIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MagicCard } from "@/components/ui/magic-card";
import { RankingTable } from "@/components/palpite/ranking-table";
import { createClient } from "@/lib/supabase/client";
import { initials, type RankingRow } from "@/lib/palpite-data";

type RankingRpcRow = {
  rank_position: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  best_players_points: number;
  exact_scores: number;
  partial_hits: number;
  penalties: number;
  predicted_matches: number;
};

type WeekRange = {
  from: string;
  to: string;
  label: string;
};

type WeeklyTop = {
  current: RankingRow[];
  previous: RankingRow[];
  currentRange: WeekRange;
  previousRange: WeekRange;
};

const weeklyPanelStoragePrefix = "palpite-weekly-top3-closed";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function getRecifeTodayAtNoonUtc() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day, 12));
}

function buildWeekRanges(): Pick<WeeklyTop, "currentRange" | "previousRange"> {
  const today = getRecifeTodayAtNoonUtc();
  const day = today.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const currentMonday = new Date(today);
  currentMonday.setUTCDate(today.getUTCDate() - daysSinceMonday);

  const currentSunday = new Date(currentMonday);
  currentSunday.setUTCDate(currentMonday.getUTCDate() + 6);

  const previousMonday = new Date(currentMonday);
  previousMonday.setUTCDate(currentMonday.getUTCDate() - 7);

  const previousSunday = new Date(previousMonday);
  previousSunday.setUTCDate(previousMonday.getUTCDate() + 6);

  const currentRange = {
    from: dateKey(currentMonday),
    to: dateKey(currentSunday),
    label: `${formatDateLabel(dateKey(currentMonday))} - ${formatDateLabel(dateKey(currentSunday))}`,
  };
  const previousRange = {
    from: dateKey(previousMonday),
    to: dateKey(previousSunday),
    label: `${formatDateLabel(dateKey(previousMonday))} - ${formatDateLabel(dateKey(previousSunday))}`,
  };

  return { currentRange, previousRange };
}

function mapRankingRow(row: RankingRpcRow, trend: RankingRow["trend"] = "same"): RankingRow {
  return {
    position: row.rank_position,
    userId: row.user_id,
    name: row.display_name,
    avatarFallback: initials(row.display_name) || "P",
    avatarUrl: row.avatar_url ?? undefined,
    points: row.total_points,
    bestPlayersPoints: row.best_players_points ?? 0,
    exactScores: row.exact_scores,
    partialHits: row.partial_hits,
    penalties: row.penalties,
    predicted: row.predicted_matches,
    trend,
  };
}

async function fetchRankingRows({
  groupId,
  from,
  to,
}: {
  groupId: string;
  from: string | null;
  to: string | null;
}) {
  const { data, error } = await createClient()
    .schema("palpite")
    .rpc("get_group_ranking", {
      p_group_id: groupId,
      p_round_name: null,
      p_match_date: null,
      p_stage: null,
      p_from: from,
      p_to: to,
    });

  if (error || !Array.isArray(data)) return [];
  return data as RankingRpcRow[];
}

export function WeeklyTopThree({ groupId }: { groupId?: string }) {
  const [weeklyTop, setWeeklyTop] = useState<WeeklyTop>(() => {
    const ranges = buildWeekRanges();
    return {
      current: [],
      previous: [],
      ...ranges,
    };
  });
  const [weeklyPanelClosed, setWeeklyPanelClosed] = useState(false);

  useEffect(() => {
    const ranges = buildWeekRanges();
    const storageKey = `${weeklyPanelStoragePrefix}:${groupId ?? "global"}:${ranges.currentRange.from}`;
    const timeout = window.setTimeout(() => {
      setWeeklyPanelClosed(window.localStorage.getItem(storageKey) === "1");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [groupId]);

  const fetchWeeklyTop = useCallback(async () => {
    if (!groupId) return;
    const ranges = buildWeekRanges();
    const [currentWeekRows, previousWeekRows] = await Promise.all([
      fetchRankingRows({ groupId, from: ranges.currentRange.from, to: ranges.currentRange.to }),
      fetchRankingRows({ groupId, from: ranges.previousRange.from, to: ranges.previousRange.to }),
    ]);

    setWeeklyTop({
      current: currentWeekRows.slice(0, 3).map((row) => mapRankingRow(row)),
      previous: previousWeekRows.slice(0, 3).map((row) => mapRankingRow(row)),
      ...ranges,
    });
  }, [groupId]);

  useEffect(() => {
    const timeout = window.setTimeout(fetchWeeklyTop, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchWeeklyTop]);

  function closeWeeklyPanel() {
    const storageKey = `${weeklyPanelStoragePrefix}:${groupId ?? "global"}:${weeklyTop.currentRange.from}`;
    window.localStorage.setItem(storageKey, "1");
    setWeeklyPanelClosed(true);
  }

  function openWeeklyPanel() {
    const storageKey = `${weeklyPanelStoragePrefix}:${groupId ?? "global"}:${weeklyTop.currentRange.from}`;
    window.localStorage.removeItem(storageKey);
    setWeeklyPanelClosed(false);
  }

  if (weeklyPanelClosed) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 w-fit gap-1.5 rounded-full text-xs"
        onClick={openWeeklyPanel}
      >
        <CrownIcon className="size-3.5" />
        Mostrar Top 3 da semana
      </Button>
    );
  }

  return <WeeklyTopPanel weeklyTop={weeklyTop} onClose={closeWeeklyPanel} />;
}

export function LiveRanking({ groupId }: { groupId?: string }) {
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [period, setPeriod] = useState<"all" | "week">("all");
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // posicoes da atualizacao anterior, para calcular subiu/desceu
  const prevPositions = useRef<Map<string, number>>(new Map());
  const hasBaseline = useRef(false);

  useEffect(() => {
    prevPositions.current = new Map();
    hasBaseline.current = false;
  }, [groupId, period]);

  const fetchRanking = useCallback(async () => {
    if (!groupId) return;
    const ranges = buildWeekRanges();
    const pFrom = period === "week" ? ranges.currentRange.from : null;
    const pTo = period === "week" ? ranges.currentRange.to : null;
    const rows = await fetchRankingRows({ groupId, from: pFrom, to: pTo });

    const mapped: RankingRow[] = rows.map((row) => {
      const previous = prevPositions.current.get(row.user_id);
      let trend: RankingRow["trend"] = "same";
      if (hasBaseline.current && previous !== undefined) {
        if (row.rank_position < previous) trend = "up";
        else if (row.rank_position > previous) trend = "down";
      }
      return mapRankingRow(row, trend);
    });
    // guarda as posicoes atuais como base para a proxima comparacao
    prevPositions.current = new Map(rows.map((r) => [r.user_id, r.rank_position]));
    hasBaseline.current = true;
    setRanking(mapped);
  }, [groupId, period]);

  useEffect(() => {
    if (!groupId) return;
    const supabase = createClient();

    const scheduleRefetch = (delay = 400) => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(fetchRanking, delay);
    };

    scheduleRefetch(0);

    const channel = supabase
      .channel(`palpite-live-ranking-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "palpite", table: "prediction_scores", filter: `group_id=eq.${groupId}` },
        () => scheduleRefetch()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "palpite", table: "matches" },
        () => scheduleRefetch()
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchRanking]);

  return (
    <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
      <CardHeader className="flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-center">
        <CardTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
          <ChartNoAxesColumnIncreasingIcon className="size-5" />
          Ranking ao vivo
        </CardTitle>
        <div className="flex flex-wrap justify-start gap-1.5 sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant={period === "all" ? "default" : "secondary"}
            className="h-8 px-2.5 text-xs"
            onClick={() => setPeriod("all")}
          >
            Geral
          </Button>
          <Button
            type="button"
            size="sm"
            variant={period === "week" ? "default" : "secondary"}
            className="h-8 px-2.5 text-xs"
            onClick={() => setPeriod("week")}
          >
            7 dias
          </Button>
          <Badge
            variant={connected ? "default" : "secondary"}
            className="gap-1"
            title={connected ? "Conectado ao vivo" : "Conectando..."}
          >
            <RadioIcon className={connected ? "size-3 animate-pulse" : "size-3"} />
            {connected ? "Ao vivo" : "Conectando..."}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <RankingTable ranking={ranking} />
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyTopPanel({
  weeklyTop,
  onClose,
}: {
  weeklyTop: WeeklyTop;
  onClose: () => void;
}) {
  return (
    <div className="sticky top-2 z-30 min-w-0">
      <MagicCard
        className="min-w-0 shadow-lg shadow-slate-950/10"
        gradientColor="rgba(245, 158, 11, 0.16)"
        gradientFrom="rgba(245, 158, 11, 0.78)"
        gradientTo="rgba(37, 99, 235, 0.5)"
      >
        <div className="min-w-0 rounded-xl bg-white/94 p-2.5 backdrop-blur-xl dark:bg-slate-950/88 sm:p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <CrownIcon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-heading text-base font-bold sm:text-lg">Top 3 da semana</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Segunda a domingo, com placar atualizado ao vivo.
                  </p>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-full"
              aria-label="Fechar top 3 da semana"
              onClick={onClose}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>

          <Tabs defaultValue="current" className="gap-2">
            <TabsList className="grid h-auto w-full grid-cols-2">
              <TabsTrigger value="current" className="h-7 text-[11px] sm:h-8 sm:text-xs">
                Essa semana
              </TabsTrigger>
              <TabsTrigger value="previous" className="h-7 text-[11px] sm:h-8 sm:text-xs">
                Semana passada
              </TabsTrigger>
            </TabsList>
            <TabsContent value="current">
              <WeeklyPodium rows={weeklyTop.current} range={weeklyTop.currentRange} empty="Sem pontuacao nesta semana." />
            </TabsContent>
            <TabsContent value="previous">
              <WeeklyPodium rows={weeklyTop.previous} range={weeklyTop.previousRange} empty="Sem pontuacao na semana passada." />
            </TabsContent>
          </Tabs>
        </div>
      </MagicCard>
    </div>
  );
}

function WeeklyPodium({
  rows,
  range,
  empty,
}: {
  rows: RankingRow[];
  range: WeekRange;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/35 p-4 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground sm:text-xs">
        <span className="truncate">{range.label}</span>
        <Badge variant="secondary" className="gap-1 px-1.5">
          <SparklesIcon className="size-3" />
          Top 3
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {rows.map((row, index) => (
          <PodiumCard key={row.userId} row={row} index={index} />
        ))}
      </div>
    </div>
  );
}

function PodiumCard({ row, index }: { row: RankingRow; index: number }) {
  const medals = ["1o", "2o", "3o"];
  const styles = [
    "border-amber-300/80 bg-amber-50 text-amber-950 shadow-amber-950/10 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100",
    "border-slate-300/80 bg-slate-50 text-slate-950 shadow-slate-950/10 dark:border-slate-300/30 dark:bg-slate-400/10 dark:text-slate-100",
    "border-orange-300/80 bg-orange-50 text-orange-950 shadow-orange-950/10 dark:border-orange-300/30 dark:bg-orange-400/10 dark:text-orange-100",
  ];

  return (
    <div className={`min-w-0 overflow-hidden rounded-lg border p-1.5 shadow-sm sm:p-2 ${styles[index] ?? styles[2]}`}>
      <div className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:text-left">
        <Badge
          className={`h-5 shrink-0 px-2 text-[10px] ${index === 0 ? "bg-amber-500 text-white" : ""}`}
          variant={index === 0 ? "default" : "secondary"}
        >
          {medals[index]}
        </Badge>
        <Avatar className="size-7 shrink-0 border bg-background sm:size-8">
          {row.avatarUrl ? <AvatarImage src={row.avatarUrl} alt={row.name} /> : null}
          <AvatarFallback className="text-[10px]">{row.avatarFallback}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 max-w-full flex-1">
          <p className="truncate text-[10px] font-bold sm:text-sm">{row.name}</p>
          <p className="hidden truncate text-[10px] opacity-75 sm:block sm:text-xs">
            {row.exactScores} exatos · {row.partialHits} parciais
          </p>
        </div>
        <div className="w-full shrink-0 rounded-md bg-slate-950 px-1.5 py-1 text-[10px] font-black tabular-nums text-white sm:w-auto sm:px-2 sm:text-sm">
          {row.points} pts
        </div>
      </div>
    </div>
  );
}
