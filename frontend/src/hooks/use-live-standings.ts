"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials, type Standing } from "@/lib/palpite-data";

type TeamRow = {
  id?: string;
  name: string | null;
  country: string | null;
  logo_url: string | null;
};

type StandingRow = {
  group_name: string | null;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  team: TeamRow | null;
};

function toTeam(row: TeamRow | null, groupName?: string | null) {
  const name = row?.name ?? "Selecao a definir";
  return {
    id: row?.id,
    name,
    shortName: row?.country ?? initials(name) ?? "TBD",
    code: "un",
    group: groupName?.replace("Group ", "") ?? "",
    logoUrl: row?.logo_url ?? undefined,
  };
}

function normalizeStanding(row: StandingRow): Standing {
  return {
    groupName: row.group_name?.replace("Group", "Grupo") ?? "Grupo",
    position: row.position,
    team: toTeam(row.team, row.group_name),
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    points: row.points,
    form: [],
  };
}

/**
 * Assina o Realtime (websocket) da tabela de classificacao e devolve a
 * classificacao da Copa atualizada ao vivo conforme os resultados saem.
 */
export function useLiveStandings(initial: Standing[]): {
  standings: Standing[];
  connected: boolean;
} {
  const [standings, setStandings] = useState<Standing[]>(initial);
  const [connected, setConnected] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStandings = useCallback(async () => {
    const supabase = createClient();
    const db = supabase.schema("palpite");

    const { data: competition } = await db
      .from("competitions")
      .select("id")
      .eq("name", "FIFA World Cup")
      .eq("season", "2026")
      .maybeSingle();
    if (!competition) return;

    const { data, error } = await db
      .from("standings")
      .select(
        "group_name, position, played, won, drawn, lost, goals_for, goals_against, points, team:team_id(id,name,country,logo_url)"
      )
      .eq("competition_id", competition.id)
      .order("group_name", { ascending: true })
      .order("position", { ascending: true });

    if (!error && Array.isArray(data)) {
      setStandings((data as unknown as StandingRow[]).map(normalizeStanding));
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefetch = (delay = 400) => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(fetchStandings, delay);
    };

    const channel = supabase
      .channel("palpite-live-standings")
      .on(
        "postgres_changes",
        { event: "*", schema: "palpite", table: "standings" },
        () => scheduleRefetch()
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [fetchStandings]);

  return { standings, connected };
}
