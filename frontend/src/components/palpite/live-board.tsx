"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, CopyIcon, ImageIcon, RadioIcon, Share2Icon, UsersIcon } from "lucide-react";
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
import {
  drawFlagBadge,
  drawTrophyWatermark,
  flagImageUrl,
  loadCanvasImage,
  withFlag,
} from "@/lib/share-visuals";
import { scoreStatusLabel, type ScoreStatus } from "@/lib/score-status-copy";

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
  const flagSrc = logo ?? flagImageUrl(label, 80);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded bg-white">
        {flagSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flagSrc} alt={`Bandeira de ${label}`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[9px] font-bold text-slate-900">{label.slice(0, 2).toUpperCase()}</span>
        )}
      </span>
      {label}
    </span>
  );
}

const statusShareEmoji: Record<ScoreStatus, string> = {
  correct: "🏆",
  partial: "✅",
  wrong: "❌",
  inverse_penalty: "🔄",
  pending: "⏳",
};

const statusImageLabel: Record<ScoreStatus, string> = {
  correct: "Acertou o placar",
  partial: "Acertou parcialmente",
  wrong: "Errou",
  inverse_penalty: "Errou",
  pending: "Aguardando resultado",
};

const statusImageColor: Record<ScoreStatus, string> = {
  correct: "#22c55e",
  partial: "#facc15",
  wrong: "#fb7185",
  inverse_penalty: "#fb7185",
  pending: "#93c5fd",
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
  const matchTitle = `${withFlag(info.home_label)} x ${withFlag(info.away_label)}`;
  const resultText =
    info.home_score === null || info.away_score === null
      ? "⏳ Placar ainda nao iniciado"
      : `📊 Resultado atual: ${info.home_score} x ${info.away_score}`;
  const lines = [
    `🏆⚽ Palpites da Copa - ${matchTitle}`,
    resultText,
    "",
    "Bora conferir quem esta mandando bem nesse jogo? 🌍⚽",
    "",
  ];

  if (participants.length === 0) {
    lines.push("Ainda nao tem palpites nesse jogo. Chama a galera para entrar na disputa! ⚽");
  } else {
    participants.slice(0, 16).forEach((row, index) => {
      const name = row.display_name ?? "Participante";
      const status = row.score_status ?? "pending";
      const podium = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "⚽";
      lines.push(
        `${podium} ${index + 1}. ${name}: ${row.predicted_home ?? "?"} x ${
          row.predicted_away ?? "?"
        } | ${row.points} pts | ${statusShareEmoji[status]} ${scoreStatusLabel(status, info.status)}`
      );
    });
    if (participants.length > 16) {
      lines.push(`... e mais ${participants.length - 16} participante(s) na disputa.`);
    }
  }

  lines.push("", "Entre, faca seu palpite e veja se voce sobe no ranking! 🏆⚽", `Acesse: ${getBaseUrl()}`);
  return lines.join("\n");
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 4 && ctx.measureText(`${value}...`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

async function loadTeamFlag(label: string, logo: string | null) {
  const flagUrl = flagImageUrl(label, 160);
  if (flagUrl) {
    const flag = await loadCanvasImage(flagUrl);
    if (flag) return flag;
  }
  return logo ? loadCanvasImage(logo) : null;
}

async function drawMatchShareImage(info: LiveBoardRow, participants: LiveBoardRow[]) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#052e5f");
  bg.addColorStop(0.48, "#061a44");
  bg.addColorStop(1, "#020617");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  await drawTrophyWatermark(ctx, W, H);

  const accent = ctx.createLinearGradient(0, 0, W, 0);
  accent.addColorStop(0, "#16a34a");
  accent.addColorStop(0.5, "#38bdf8");
  accent.addColorStop(1, "#f97316");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 16);

  const logo = await loadCanvasImage("/logo/logo-apenas-desenho-sem-fundo.svg");
  if (logo) ctx.drawImage(logo, 64, 54, 116, 116);

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px Arial, sans-serif";
  ctx.fillText("Palpitô", 198, 108);
  ctx.fillStyle = "#bfdbfe";
  ctx.font = "600 31px Arial, sans-serif";
  ctx.fillText("Palpites do jogo", 200, 154);

  const isLive = info.status === "live" || info.status === "halftime";
  const isFinished = info.status === "finished";
  ctx.textAlign = "right";
  ctx.fillStyle = isLive ? "#fecaca" : "#bfdbfe";
  ctx.font = "800 30px Arial, sans-serif";
  ctx.fillText(isLive ? "AO VIVO" : isFinished ? "FINAL" : "AGENDADO", W - 72, 104);

  const homeFlag = await loadTeamFlag(info.home_label, info.home_logo);
  const awayFlag = await loadTeamFlag(info.away_label, info.away_logo);

  const matchY = 265;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(64, matchY, W - 128, 360, 34);
  ctx.fill();

  drawFlagBadge(ctx, homeFlag, info.home_label, 112, matchY + 70, 128, 90);
  drawFlagBadge(ctx, awayFlag, info.away_label, W - 240, matchY + 70, 128, 90);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = "800 42px Arial, sans-serif";
  ctx.fillText(fitText(ctx, info.home_label, 310), 112, matchY + 210);
  ctx.textAlign = "right";
  ctx.fillText(fitText(ctx, info.away_label, 310), W - 112, matchY + 210);

  ctx.textAlign = "center";
  ctx.fillStyle = "#facc15";
  ctx.font = "900 88px Arial, sans-serif";
  ctx.fillText(`${info.home_score ?? "-"} x ${info.away_score ?? "-"}`, W / 2, matchY + 175);

  ctx.fillStyle = "#bfdbfe";
  ctx.font = "600 30px Arial, sans-serif";
  ctx.fillText(
    info.home_score === null || info.away_score === null
      ? "Aguardando placar"
      : isLive
        ? "Resultado atual"
        : isFinished
          ? "Resultado final"
          : `Jogo ${formatKickoff(info.match_date)}`,
    W / 2,
    matchY + 265,
  );

  const summary = {
    correct: participants.filter((row) => row.score_status === "correct").length,
    partial: participants.filter((row) => row.score_status === "partial").length,
    wrong: participants.filter((row) => row.score_status === "wrong" || row.score_status === "inverse_penalty").length,
  };

  const chipY = matchY + 300;
  const chips = [
    { text: `${summary.correct} placar exato`, color: "#22c55e" },
    { text: `${summary.partial} parcial`, color: "#facc15" },
    { text: `${summary.wrong} errou`, color: "#fb7185" },
  ];
  let chipX = 137;
  for (const chip of chips) {
    ctx.fillStyle = "rgba(15,23,42,0.62)";
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, 250, 44, 22);
    ctx.fill();
    ctx.fillStyle = chip.color;
    ctx.beginPath();
    ctx.arc(chipX + 28, chipY + 22, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 24px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(chip.text, chipX + 48, chipY + 30);
    chipX += 270;
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 42px Arial, sans-serif";
  ctx.fillText("Palpites", 80, 720);

  ctx.textAlign = "right";
  ctx.fillStyle = "#93c5fd";
  ctx.font = "700 28px Arial, sans-serif";
  ctx.fillText(`${participants.length} participante(s)`, W - 80, 720);

  const rowStartY = 790;
  const rowH = 88;
  const maxRows = 11;
  const shown = participants.slice(0, maxRows);

  if (shown.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(72, rowStartY, W - 144, 112, 24);
    ctx.fill();
    ctx.fillStyle = "#bfdbfe";
    ctx.font = "700 34px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Nenhum palpite ainda neste jogo.", W / 2, rowStartY + 70);
  } else {
    shown.forEach((row, index) => {
      const y = rowStartY + index * rowH;
      const status = row.score_status ?? "pending";
      const name = row.display_name ?? "Participante";

      ctx.fillStyle = index % 2 === 0 ? "rgba(255,255,255,0.085)" : "rgba(255,255,255,0.045)";
      ctx.beginPath();
      ctx.roundRect(72, y, W - 144, 70, 20);
      ctx.fill();

      ctx.fillStyle = "#dbeafe";
      ctx.font = "800 26px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${index + 1}.`, 96, y + 45);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 30px Arial, sans-serif";
      ctx.fillText(fitText(ctx, name, 360), 150, y + 45);

      ctx.textAlign = "center";
      ctx.fillStyle = "#facc15";
      ctx.font = "900 32px Arial, sans-serif";
      ctx.fillText(`${row.predicted_home ?? "?"} x ${row.predicted_away ?? "?"}`, 570, y + 45);

      ctx.textAlign = "left";
      ctx.fillStyle = statusImageColor[status];
      ctx.font = "800 24px Arial, sans-serif";
      ctx.fillText(fitText(ctx, statusImageLabel[status], 220), 686, y + 32);
      ctx.fillStyle = "#bfdbfe";
      ctx.font = "700 21px Arial, sans-serif";
      ctx.fillText(`${row.points > 0 ? "+" : ""}${row.points} pts`, 686, y + 57);
    });
  }

  if (participants.length > maxRows) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#93c5fd";
    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillText(`+${participants.length - maxRows} palpites no jogo`, W / 2, rowStartY + maxRows * rowH + 18);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#bfdbfe";
  ctx.font = "700 31px Arial, sans-serif";
  ctx.fillText("Acompanhe os palpites ao vivo", W / 2, H - 150);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 34px Arial, sans-serif";
  ctx.fillText(getBaseUrl(), W / 2, H - 104);

  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function ShareMatchButton({ info, participants }: { info: LiveBoardRow; participants: LiveBoardRow[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
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

  async function shareImage() {
    setGenerating(true);
    try {
      const blob = await drawMatchShareImage(info, participants);
      if (!blob) {
        toast.error("Nao foi possivel gerar a imagem.");
        return;
      }
      const file = new File([blob], "palpites-do-jogo.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Palpites do jogo",
          text: `${info.home_label} x ${info.away_label}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "palpites-do-jogo.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Imagem gerada.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error("Nao foi possivel compartilhar a imagem.");
      }
    } finally {
      setGenerating(false);
    }
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
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={copyText}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button onClick={sendWhatsApp}>
            <Share2Icon className="size-4" />
            WhatsApp
          </Button>
          <Button onClick={shareImage} disabled={generating}>
            <ImageIcon className="size-4" />
            {generating ? "Gerando..." : "Imagem"}
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
        const waitingLiveScore = isLive && (info.home_score === null || info.away_score === null);
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
                    {waitingLiveScore ? "Ao vivo aguardando placar" : isFinished ? "Encerrado" : `Hoje ${formatKickoff(info.match_date)}`}
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
                  {waitingLiveScore ? "Aguardando placar" : isLive ? "Ao vivo" : isFinished ? "Finalizado" : "Agendado"}
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
                                    {scoreStatusLabel(status, info.status)}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold tabular-nums">
                              {row.predicted_home ?? "?"} : {row.predicted_away ?? "?"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant={statusVariant(status)}>{scoreStatusLabel(status, info.status)}</Badge>
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
