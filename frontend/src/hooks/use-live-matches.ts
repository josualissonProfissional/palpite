"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match } from "@/lib/palpite-data";

type LiveOverride = {
  homeScore?: number;
  awayScore?: number;
  status: Match["status"];
};

type MatchRow = {
  id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
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
export function useLiveMatches(initial: Match[]): {
  matches: Match[];
  connected: boolean;
} {
  const [overrides, setOverrides] = useState<Record<string, LiveOverride>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const matches = initial.map((match) => {
    const override = overrides[match.id];
    if (!override) return match;
    return {
      ...match,
      homeScore: override.homeScore ?? match.homeScore,
      awayScore: override.awayScore ?? match.awayScore,
      status: override.status,
    };
  });

  return { matches, connected };
}
