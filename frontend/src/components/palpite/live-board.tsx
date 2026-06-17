"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RadioIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/palpite/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/palpite-data";

type ScoreStatus = "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";

type LiveBoardRow = {
  match_id: string;
  match_date: string;
  status: string;
  home_label: string;
  away_label: string;
  home_logo: string | null;
  away_logo: string | null;
  home_score: number | null;
  away_score: number | null;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  predicted_home: number | null;
  predicted_away: number | null;
  points: number;
  score_status: ScoreStatus | null;
  score_reason: string | null;
  is_final: boolean;
};

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Recife",
  }).format(new Date(value));
}

function TeamFlagLabel({ logo, label }: { logo: string | null; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded bg-white">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`Bandeira de ${label}`} className="h-full w-full object-cover" />
        ) : null}
      </span>
      {label}
    </span>
  );
}

const statusLabel: Record<ScoreStatus, string> = {
  correct: "Placar exato",
  partial: "Parcial",
  wrong: "Errou",
  inverse_penalty: "Placar invertido",
  pending: "Aguardando",
};

function statusVariant(status: ScoreStatus): "default" | "secondary" | "destructive" {
  if (status === "correct") return "default";
  if (status === "wrong" || status === "inverse_penalty") return "destructive";
  return "secondary";
}

export function LiveBoard({ groupId }: { groupId?: string }) {
  const [rows, setRows] = useState<LiveBoardRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!groupId) return;
    const { data, error } = await createClient()
      .schema("palpite")
      .rpc("get_group_live_board", { p_group_id: groupId });
    if (!error && Array.isArray(data)) {
      setRows(data as LiveBoardRow[]);
    }
    setLoaded(true);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    const supabase = createClient();

    // refetch com debounce (tambem usado para a carga inicial, deferida)
    const scheduleRefetch = (delay = 400) => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(fetchBoard, delay);
    };

    scheduleRefetch(0);

    const channel = supabase
      .channel(`palpite-live-board-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "palpite", table: "prediction_scores", filter: `group_id=eq.${groupId}` },
        () => scheduleRefetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "palpite", table: "predictions", filter: `group_id=eq.${groupId}` },
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
  }, [groupId, fetchBoard]);

  const matches = useMemo(() => {
    const byMatch = new Map<string, { info: LiveBoardRow; rows: LiveBoardRow[] }>();
    for (const row of rows) {
      const entry = byMatch.get(row.match_id);
      if (entry) {
        entry.rows.push(row);
      } else {
        byMatch.set(row.match_id, { info: row, rows: [row] });
      }
    }
    return Array.from(byMatch.values());
  }, [rows]);

  if (!loaded) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Carregando palpites..."
        description="Buscando os palpites de todos os participantes."
      />
    );
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Nenhum jogo hoje"
        description="Quando houver jogos hoje, os palpites de todos os participantes aparecem aqui, jogo por jogo."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Palpites de todos os participantes, com a situacao atualizada ao vivo.
        </p>
        <Badge
          variant={connected ? "default" : "secondary"}
          className="gap-1"
          title={connected ? "Conectado ao vivo" : "Conectando..."}
        >
          <RadioIcon className={connected ? "size-3 animate-pulse" : "size-3"} />
          {connected ? "Ao vivo conectado" : "Conectando..."}
        </Badge>
      </div>

      {matches.map(({ info, rows: matchRows }) => {
        const isLive = info.status === "live" || info.status === "halftime";
        const isFinished = info.status === "finished";
        const participants = matchRows
          .filter((row) => row.user_id)
          .sort((a, b) => b.points - a.points);
        const acertando = participants.filter((r) => r.score_status === "correct").length;
        return (
          <Card
            key={info.match_id}
            className="overflow-hidden border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70"
          >
            <CardHeader className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg px-3 py-1.5 text-center text-base font-bold text-white ${
                    isLive ? "bg-red-600 animate-pulse" : "bg-slate-950"
                  }`}
                >
                  {info.home_score ?? "-"} : {info.away_score ?? "-"}
                </div>
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-1.5 text-base">
                    <TeamFlagLabel logo={info.home_logo} label={info.home_label} />
                    <span className="text-muted-foreground">x</span>
                    <TeamFlagLabel logo={info.away_logo} label={info.away_label} />
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {isFinished ? "Encerrado" : `Hoje ${formatKickoff(info.match_date)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {acertando > 0 ? (
                  <Badge variant="secondary">{acertando} no placar exato</Badge>
                ) : null}
                <Badge variant={isLive ? "destructive" : "secondary"} className="gap-1">
                  {isLive ? <RadioIcon className="size-3" /> : null}
                  {isLive ? "Ao vivo" : isFinished ? "Finalizado" : "Agendado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-white/50 p-4 text-center text-sm text-muted-foreground dark:bg-slate-950/40">
                  Nenhum palpite ainda neste jogo.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participante</TableHead>
                        <TableHead className="text-center">Palpite</TableHead>
                        <TableHead className="hidden sm:table-cell">Situacao</TableHead>
                        <TableHead className="text-right">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((row) => {
                        const status = row.score_status ?? "pending";
                        const name = row.display_name ?? "Participante";
                        return (
                          <TableRow key={`${row.match_id}-${row.user_id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="size-6 border sm:size-7">
                                  {row.avatar_url ? (
                                    <AvatarImage src={row.avatar_url} alt={name} />
                                  ) : null}
                                  <AvatarFallback className="text-[10px]">{initials(name) || "P"}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <span className="block max-w-28 truncate font-medium sm:max-w-40">{name}</span>
                                  <span className="text-[11px] text-muted-foreground sm:hidden">
                                    {statusLabel[status]}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold tabular-nums">
                              {row.predicted_home ?? "?"} : {row.predicted_away ?? "?"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant={statusVariant(status)}>{statusLabel[status]}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums">
                              {row.points > 0 ? "+" : ""}
                              {row.points}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
