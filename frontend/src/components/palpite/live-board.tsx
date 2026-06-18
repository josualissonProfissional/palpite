"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, CopyIcon, RadioIcon, Share2Icon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/palpite/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/base-url";
import { initials } from "@/lib/palpite-data";

type ScoreStatus = "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
type BoardFilter = "today" | "yesterday" | "tomorrow" | "last5" | "last7" | "last15" | "last30" | "last45";

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

function dateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Recife",
  }).format(value);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function boardRange(filter: BoardFilter) {
  const today = new Date();
  if (filter === "yesterday") {
    const day = addDays(today, -1);
    return { from: dateKey(day), to: dateKey(day) };
  }
  if (filter === "tomorrow") {
    const day = addDays(today, 1);
    return { from: dateKey(day), to: dateKey(day) };
  }
  if (filter.startsWith("last")) {
    const days = Number(filter.replace("last", ""));
    return { from: dateKey(addDays(today, -(days - 1))), to: dateKey(today) };
  }
  return { from: dateKey(today), to: dateKey(today) };
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

const boardFilters: { value: BoardFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "tomorrow", label: "Amanha" },
  { value: "last5", label: "Ultimos 5" },
  { value: "last7", label: "Ultimos 7" },
  { value: "last15", label: "Ultimos 15" },
  { value: "last30", label: "Ultimos 30" },
  { value: "last45", label: "Ultimos 45" },
];

function statusVariant(status: ScoreStatus): "default" | "secondary" | "destructive" {
  if (status === "correct") return "default";
  if (status === "wrong" || status === "inverse_penalty") return "destructive";
  return "secondary";
}

function buildMatchShareText(info: LiveBoardRow, participants: LiveBoardRow[]) {
  const lines = [
    `Palpites - ${info.home_label} x ${info.away_label}`,
    info.home_score === null || info.away_score === null
      ? "Placar ainda nao iniciado"
      : `Resultado: ${info.home_score} x ${info.away_score}`,
    "",
  ];

  if (participants.length === 0) {
    lines.push("Sem palpites neste jogo.");
  } else {
    participants.slice(0, 16).forEach((row, index) => {
      const name = row.display_name ?? "Participante";
      const status = row.score_status ? `, ${statusLabel[row.score_status]}` : "";
      lines.push(
        `${index + 1}. ${name}: ${row.predicted_home ?? "?"} x ${row.predicted_away ?? "?"} (${row.points} pts${status})`
      );
    });
  }

  lines.push("", `Acesse: ${getBaseUrl()}`);
  return lines.join("\n");
}

function ShareMatchButton({ info, participants }: { info: LiveBoardRow; participants: LiveBoardRow[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => buildMatchShareText(info, participants), [info, participants]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Palpites do jogo copiados.");
    } catch {
      toast.error("Nao foi possivel copiar. Selecione o texto manualmente.");
    }
  }

  function sendWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setCopied(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2Icon className="size-4" />
          Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Compartilhar jogo</DialogTitle>
          <DialogDescription>
            Envie os palpites deste jogo para o grupo.
          </DialogDescription>
        </DialogHeader>
        <Textarea readOnly value={text} className="h-64 resize-none text-sm" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={copyText}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button onClick={sendWhatsApp}>
            <Share2Icon className="size-4" />
            WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LiveBoard({ groupId }: { groupId?: string }) {
  const [rows, setRows] = useState<LiveBoardRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<BoardFilter>("today");
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const range = useMemo(() => boardRange(filter), [filter]);

  const fetchBoard = useCallback(async () => {
    if (!groupId) return;
    setLoaded(false);
    const { data, error } = await createClient()
      .schema("palpite")
      .rpc("get_group_live_board", {
        p_group_id: groupId,
        p_from: range.from,
        p_to: range.to,
      });
    if (!error && Array.isArray(data)) {
      setRows(data as LiveBoardRow[]);
    }
    setLoaded(true);
  }, [groupId, range.from, range.to]);

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
      <Tabs value={filter} onValueChange={(value) => setFilter(value as BoardFilter)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {boardFilters.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="h-8 px-2.5 text-xs sm:text-sm">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!loaded ? (
        <EmptyState
          icon={UsersIcon}
          title="Carregando palpites..."
          description="Buscando os palpites de todos os participantes."
        />
      ) : null}

      {loaded && matches.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Nenhum jogo neste periodo"
          description="Escolha outro filtro para ver os palpites por jogo."
        />
      ) : null}

      {loaded && matches.map(({ info, rows: matchRows }) => {
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
                <ShareMatchButton info={info} participants={participants} />
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
