"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CopyIcon, ImageIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/base-url";
import { initials, type RankingRow } from "@/lib/palpite-data";
import {
  drawFlagBadge,
  drawTrophyWatermark,
  flagImageUrl,
  loadCanvasImage,
  withFlag,
} from "@/lib/share-visuals";
import { scoreStatusShortLabel, type ScoreStatus } from "@/lib/score-status-copy";

type ShareMode = "ranking" | "board" | "both";

type RankingRpcRow = {
  position: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  best_players_points: number;
  exact_scores: number;
  partial_hits: number;
  penalties: number;
  predicted_count: number;
};

type LiveBoardShareRow = {
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
  predicted_home: number | null;
  predicted_away: number | null;
  points: number;
  score_status: ScoreStatus | null;
};

type MatchBoard = {
  matchId: string;
  homeLabel: string;
  awayLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
  title: string;
  score: string;
  status: string;
  participants: LiveBoardShareRow[];
};

type ShareGroupSummaryProps = {
  groupId?: string;
  groupName: string;
  ranking?: RankingRow[];
  size?: "sm" | "default";
};

const modeLabels: Record<ShareMode, string> = {
  ranking: "Ranking",
  board: "Palpites",
  both: "Tudo",
};

function mapRanking(rows: RankingRpcRow[]): RankingRow[] {
  return rows.map((row) => ({
    position: row.position,
    userId: row.user_id,
    name: row.display_name,
    avatarFallback: initials(row.display_name) || "P",
    avatarUrl: row.avatar_url ?? undefined,
    points: row.total_points,
    bestPlayersPoints: row.best_players_points ?? 0,
    exactScores: row.exact_scores,
    partialHits: row.partial_hits,
    penalties: row.penalties,
    predicted: row.predicted_count,
    trend: "same",
  }));
}

function groupBoard(rows: LiveBoardShareRow[]): MatchBoard[] {
  const byMatch = new Map<string, MatchBoard>();
  for (const row of rows) {
    const current = byMatch.get(row.match_id);
    const board =
      current ??
      {
        matchId: row.match_id,
        homeLabel: row.home_label,
        awayLabel: row.away_label,
        homeLogo: row.home_logo,
        awayLogo: row.away_logo,
        title: `${row.home_label} x ${row.away_label}`,
        score:
          row.home_score === null || row.away_score === null
            ? "Placar ainda nao iniciado"
            : `Resultado: ${row.home_score} x ${row.away_score}`,
        status: row.status === "live" ? "ao vivo" : row.status === "finished" ? "final" : "agendado",
        participants: [],
      };

    if (row.user_id) board.participants.push(row);
    byMatch.set(row.match_id, board);
  }

  return Array.from(byMatch.values()).map((match) => ({
    ...match,
    participants: match.participants.sort((a, b) => b.points - a.points),
  }));
}

function buildText(mode: ShareMode, groupName: string, ranking: RankingRow[], board: MatchBoard[]) {
  const lines = [`Palpitô - ${groupName}`, ""];

  if (mode === "ranking" || mode === "both") {
    lines.push("Ranking:");
    if (ranking.length === 0) {
      lines.push("Sem pontuacao ainda.");
    } else {
      ranking.slice(0, 12).forEach((row) => {
        lines.push(`${row.position}. ${row.name} - ${row.points} pts`);
      });
    }
    lines.push("");
  }

  if (mode === "board" || mode === "both") {
    lines.push("Palpites de todos:");
    if (board.length === 0) {
      lines.push("Nenhum palpite disponivel para compartilhar agora.");
    } else {
      board.slice(0, 4).forEach((match) => {
        lines.push(
          `${withFlag(match.homeLabel)} x ${withFlag(match.awayLabel)} | ${match.score} (${match.status})`,
        );
        if (match.participants.length === 0) {
          lines.push("- Sem palpites neste jogo.");
        } else {
          match.participants.slice(0, 8).forEach((row) => {
            const name = row.display_name ?? "Participante";
            const status = row.score_status ? `, ${scoreStatusShortLabel(row.score_status, row.status)}` : "";
            lines.push(`- ${name}: ${row.predicted_home ?? "?"} x ${row.predicted_away ?? "?"} (${row.points} pts${status})`);
          });
        }
        lines.push("");
      });
    }
  }

  lines.push(`Acesse: ${getBaseUrl()}`);
  return lines.join("\n").trim();
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

async function drawShareImage(mode: ShareMode, groupName: string, ranking: RankingRow[], board: MatchBoard[]) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const context = ctx;

  const bg = context.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#061a44");
  bg.addColorStop(1, "#020617");
  context.fillStyle = bg;
  context.fillRect(0, 0, W, H);
  await drawTrophyWatermark(context, W, H);

  const logo = await loadCanvasImage("/logo/logo-apenas-desenho-sem-fundo.svg");
  if (logo) context.drawImage(logo, 64, 58, 112, 112);

  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  context.font = "800 62px Arial, sans-serif";
  context.fillText("Palpitô", 200, 112);
  context.font = "600 34px Arial, sans-serif";
  context.fillStyle = "#93c5fd";
  context.fillText(fitText(context, groupName, 760), 200, 160);

  context.textAlign = "center";
  context.fillStyle = "#ffffff";
  context.font = "800 58px Arial, sans-serif";
  context.fillText(modeLabels[mode].toUpperCase(), W / 2, 260);

  let y = 340;

  function sectionTitle(title: string) {
    context.textAlign = "left";
    context.fillStyle = "#38bdf8";
    context.font = "800 38px Arial, sans-serif";
    context.fillText(title, 80, y);
    y += 56;
  }

  function row(textLeft: string, textRight?: string) {
    context.fillStyle = "rgba(255,255,255,0.075)";
    context.beginPath();
    context.roundRect(72, y - 38, W - 144, 58, 18);
    context.fill();
    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font = "700 30px Arial, sans-serif";
    context.fillText(fitText(context, textLeft, textRight ? 700 : 860), 96, y);
    if (textRight) {
      context.textAlign = "right";
      context.fillStyle = "#facc15";
      context.fillText(textRight, W - 96, y);
    }
    y += 72;
  }

  if (mode === "ranking" || mode === "both") {
    sectionTitle("Ranking");
    const shownRanking = ranking.slice(0, mode === "both" ? 6 : 12);
    if (shownRanking.length === 0) {
      row("Sem pontuacao ainda");
    } else {
      shownRanking.forEach((item) => row(`${item.position}. ${item.name}`, `${item.points} pts`));
    }
    y += 24;
  }

  if (mode === "board" || mode === "both") {
    sectionTitle("Palpites de todos");
    const shownBoard = board.slice(0, mode === "both" ? 2 : 4);
    if (shownBoard.length === 0) {
      row("Nenhum palpite disponivel agora");
    } else {
      for (const match of shownBoard) {
        const homeFlag = await loadTeamFlag(match.homeLabel, match.homeLogo);
        const awayFlag = await loadTeamFlag(match.awayLabel, match.awayLogo);

        context.textAlign = "left";
        context.fillStyle = "#bfdbfe";
        context.font = "800 30px Arial, sans-serif";
        drawFlagBadge(context, homeFlag, match.homeLabel, 84, y - 34, 54, 36);
        context.fillText(fitText(context, match.homeLabel, 250), 154, y - 7);
        context.textAlign = "center";
        context.fillStyle = "#facc15";
        context.font = "900 28px Arial, sans-serif";
        context.fillText("x", W / 2, y - 7);
        drawFlagBadge(context, awayFlag, match.awayLabel, W - 138, y - 34, 54, 36);
        context.textAlign = "right";
        context.fillStyle = "#bfdbfe";
        context.font = "800 30px Arial, sans-serif";
        context.fillText(fitText(context, match.awayLabel, 250), W - 154, y - 7);
        context.textAlign = "center";
        context.fillStyle = "#93c5fd";
        context.font = "600 24px Arial, sans-serif";
        context.fillText(fitText(context, match.score, 700), W / 2, y + 28);
        y += 48;
        match.participants.slice(0, mode === "both" ? 4 : 6).forEach((p) => {
          const name = p.display_name ?? "Participante";
          row(`${name}: ${p.predicted_home ?? "?"} x ${p.predicted_away ?? "?"}`, `${p.points} pts`);
        });
        y += 12;
      }
    }
  }

  context.textAlign = "center";
  context.fillStyle = "#93c5fd";
  context.font = "600 34px Arial, sans-serif";
  context.fillText(getBaseUrl(), W / 2, H - 90);

  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export function ShareGroupSummary({
  groupId,
  groupName,
  ranking: initialRanking = [],
  size = "sm",
}: ShareGroupSummaryProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ShareMode>("both");
  const [ranking, setRanking] = useState<RankingRow[]>(initialRanking);
  const [boardRows, setBoardRows] = useState<LiveBoardShareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || !groupId) return;
    let active = true;

    (async () => {
      try {
        const supabase = createClient();
        const [rankingResult, boardResult] = await Promise.all([
          supabase.schema("palpite").rpc("get_group_ranking", {
            p_group_id: groupId,
            p_stage: "all",
            p_match_date: null,
            p_round: "all",
            p_from: null,
            p_to: null,
          }),
          supabase.schema("palpite").rpc("get_group_live_board", { p_group_id: groupId }),
        ]);

        if (!active) return;
        if (!rankingResult.error && Array.isArray(rankingResult.data)) {
          setRanking(mapRanking(rankingResult.data as RankingRpcRow[]));
        }
        if (!boardResult.error && Array.isArray(boardResult.data)) {
          setBoardRows(boardResult.data as LiveBoardShareRow[]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [groupId, open]);

  const board = useMemo(() => groupBoard(boardRows), [boardRows]);
  const text = useMemo(() => buildText(mode, groupName, ranking, board), [mode, groupName, ranking, board]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setCopied(false);
    if (nextOpen && groupId) setLoading(true);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Compartilhamento copiado.");
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
      const blob = await drawShareImage(mode, groupName, ranking, board);
      if (!blob) {
        toast.error("Nao foi possivel gerar a imagem.");
        return;
      }

      const file = new File([blob], `palpito-${mode}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Palpitô", text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `palpito-${mode}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Imagem salva.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error("Nao foi possivel compartilhar a imagem.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size={size}>
          <Share2Icon className="size-4" />
          Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compartilhar grupo</DialogTitle>
          <DialogDescription>
            Escolha se quer enviar o ranking, os palpites de todos ou os dois juntos.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => setMode(value as ShareMode)}>
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="board">Palpites</TabsTrigger>
            <TabsTrigger value="both">Os dois</TabsTrigger>
          </TabsList>
        </Tabs>

        <Textarea readOnly value={loading ? "Atualizando dados..." : text} className="h-72 resize-none text-sm" />

        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={copyText} disabled={loading}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copiado" : "Copiar texto"}
          </Button>
          <Button variant="secondary" onClick={sendWhatsApp} disabled={loading}>
            <Share2Icon className="size-4" />
            WhatsApp
          </Button>
          <Button onClick={shareImage} disabled={loading || generating}>
            <ImageIcon className="size-4" />
            {generating ? "Gerando..." : "Gerar imagem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
