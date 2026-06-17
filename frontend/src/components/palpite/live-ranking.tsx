"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChartNoAxesColumnIncreasingIcon, RadioIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RankingTable } from "@/components/palpite/ranking-table";
import { createClient } from "@/lib/supabase/client";
import { initials, type RankingRow } from "@/lib/palpite-data";

type RankingRpcRow = {
  rank_position: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  exact_scores: number;
  partial_hits: number;
  penalties: number;
  predicted_matches: number;
};

export function LiveRanking({ groupId }: { groupId?: string }) {
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [connected, setConnected] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // posicoes da atualizacao anterior, para calcular subiu/desceu
  const prevPositions = useRef<Map<string, number>>(new Map());
  const hasBaseline = useRef(false);

  const fetchRanking = useCallback(async () => {
    if (!groupId) return;
    const { data, error } = await createClient()
      .schema("palpite")
      .rpc("get_group_ranking", {
        p_group_id: groupId,
        p_round_name: null,
        p_match_date: null,
        p_stage: null,
        p_from: null,
        p_to: null,
      });
    if (!error && Array.isArray(data)) {
      const rows = data as RankingRpcRow[];
      const mapped: RankingRow[] = rows.map((row) => {
        const previous = prevPositions.current.get(row.user_id);
        let trend: RankingRow["trend"] = "same";
        if (hasBaseline.current && previous !== undefined) {
          if (row.rank_position < previous) trend = "up";
          else if (row.rank_position > previous) trend = "down";
        }
        return {
          position: row.rank_position,
          userId: row.user_id,
          name: row.display_name,
          avatarFallback: initials(row.display_name) || "P",
          avatarUrl: row.avatar_url ?? undefined,
          points: row.total_points,
          exactScores: row.exact_scores,
          partialHits: row.partial_hits,
          penalties: row.penalties,
          predicted: row.predicted_matches,
          trend,
        };
      });
      // guarda as posicoes atuais como base para a proxima comparacao
      prevPositions.current = new Map(rows.map((r) => [r.user_id, r.rank_position]));
      hasBaseline.current = true;
      setRanking(mapped);
    }
  }, [groupId]);

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
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 font-heading text-xl">
          <ChartNoAxesColumnIncreasingIcon className="size-5" />
          Ranking ao vivo
        </CardTitle>
        <Badge
          variant={connected ? "default" : "secondary"}
          className="gap-1"
          title={connected ? "Conectado ao vivo" : "Conectando..."}
        >
          <RadioIcon className={connected ? "size-3 animate-pulse" : "size-3"} />
          {connected ? "Ao vivo" : "Conectando..."}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <RankingTable ranking={ranking} />
        </div>
      </CardContent>
    </Card>
  );
}
