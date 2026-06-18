"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match } from "@/lib/palpite-data";

type LiveOverride = {
  homeScore?: number;
  awayScore?: number;
  status: Match["status"];
};

type ScoreOverride = {
  points: number;
  scoreStatus: Match["scoreStatus"];
  scoreReason?: string;
  isFinalScore: boolean;
};

type MatchRow = {
  id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type PredictionScoreRow = {
  match_id: string;
  user_id: string;
  points: number;
  status: Match["scoreStatus"];
  score_reason: string | null;
  is_final: boolean;
};

function toUiStatus(status: string): Match["status"] {
  if (status === "finished") return "finished";
  if (status === "live" || status === "halftime") return "live";
  return "scheduled";
}

/**
 * Assina o canal Realtime (websocket) do Supabase e devolve a lista de jogos
 * com os placares e status atualizados ao vivo, sem precisar recarregar a pagina.
 */
export function useLiveMatches(initial: Match[], groupId?: string): {
  matches: Match[];
  connected: boolean;
} {
  const [overrides, setOverrides] = useState<Record<string, LiveOverride>>({});
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, ScoreOverride>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const channel = supabase
      .channel("palpite-live-matches")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "palpite", table: "matches" },
        (payload) => {
          const row = payload.new as MatchRow;
          if (!row?.id) return;
          setOverrides((prev) => ({
            ...prev,
            [row.id]: {
              homeScore: row.home_score ?? undefined,
              awayScore: row.away_score ?? undefined,
              status: toUiStatus(row.status),
            },
          }));
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    async function subscribeScores() {
      if (!groupId) return null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) return null;

      const scoreChannel = supabase
        .channel(`palpite-live-match-scores-${groupId}-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "palpite", table: "prediction_scores", filter: `group_id=eq.${groupId}` },
          (payload) => {
            const row = (payload.new ?? payload.old) as PredictionScoreRow | null;
            if (!row?.match_id || row.user_id !== user.id) return;

            if (payload.eventType === "DELETE") {
              setScoreOverrides((prev) => {
                const next = { ...prev };
                delete next[row.match_id];
                return next;
              });
              return;
            }

            setScoreOverrides((prev) => ({
              ...prev,
              [row.match_id]: {
                points: row.points,
                scoreStatus: row.status,
                scoreReason: row.score_reason ?? undefined,
                isFinalScore: row.is_final,
              },
            }));
          }
        )
        .subscribe();
      return scoreChannel;
    }

    let scoreChannel: Awaited<ReturnType<typeof subscribeScores>> = null;
    void subscribeScores().then((channelRef) => {
      if (!mounted && channelRef) {
        void supabase.removeChannel(channelRef);
        return;
      }
      scoreChannel = channelRef;
    });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      if (scoreChannel) void supabase.removeChannel(scoreChannel);
    };
  }, [groupId]);

  const matches = initial.map((match) => {
    const override = overrides[match.id];
    const score = scoreOverrides[match.id];
    if (!override && !score) return match;
    return {
      ...match,
      homeScore: override?.homeScore ?? match.homeScore,
      awayScore: override?.awayScore ?? match.awayScore,
      status: override?.status ?? match.status,
      points: score?.points ?? match.points,
      scoreStatus: score?.scoreStatus ?? match.scoreStatus,
      scoreReason: score?.scoreReason ?? match.scoreReason,
      isFinalScore: score?.isFinalScore ?? match.isFinalScore,
    };
  });

  return { matches, connected };
}
