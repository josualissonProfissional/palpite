"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { getBaseUrl } from "@/lib/base-url";
import { cn } from "@/lib/utils";
import {
  drawFlagBadge,
  drawTrophyWatermark,
  flagImageUrl,
  loadCanvasImage,
  withFlag,
} from "@/lib/share-visuals";
import { scoreStatusShortLabel } from "@/lib/score-status-copy";

export type SharePrediction = {
  home: string;
  away: string;
  homeFlagUrl?: string;
  awayFlagUrl?: string;
  homeFlagHint?: string;
  awayFlagHint?: string;
  predictedHome: number;
  predictedAway: number;
  resultHome?: number;
  resultAway?: number;
  matchStatus?: "live" | "scheduled" | "finished" | "locked";
  status?: "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
  points?: number;
};

type SharePredictionsProps = {
  groupName: string;
  predictions: SharePrediction[];
  totalPoints: number;
  triggerLabel?: string;
  triggerClassName?: string;
};

const statusEmoji: Record<NonNullable<SharePrediction["status"]>, string> = {
  correct: "🟢",
  partial: "🟡",
  wrong: "🔴",
  inverse_penalty: "🔴",
  pending: "⚪",
};

function resultTag(p: SharePrediction) {
  if (typeof p.resultHome !== "number" || typeof p.resultAway !== "number") return "";
  const live = p.matchStatus === "live" ? " (ao vivo)" : p.matchStatus === "finished" ? " (final)" : "";
  return ` | Resultado: ${p.resultHome} x ${p.resultAway}${live}`;
}

function buildText({ groupName, predictions, totalPoints }: SharePredictionsProps) {
  const lines = predictions.map((p) => {
    const dot = p.status ? `${statusEmoji[p.status]} ` : "⚽ ";
    const status = p.status && p.status !== "pending" ? ` | ${scoreStatusShortLabel(p.status, p.matchStatus)}` : "";
    return `${dot}${withFlag(p.home, p.homeFlagHint)} ${p.predictedHome} x ${p.predictedAway} ${withFlag(
      p.away,
      p.awayFlagHint,
    )}${status}${resultTag(p)}`;
  });
  return [
    `🏆 Meus palpites — ${groupName}`,
    "",
    ...lines,
    "",
    `Total: ${totalPoints} pts`,
    `Faça o seu no Palpitô: ${getBaseUrl()}`,
  ].join("\n");
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 4 && ctx.measureText(`${value}...`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

async function drawStoryImage({ groupName, predictions, totalPoints }: SharePredictionsProps): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1f4d");
  bg.addColorStop(1, "#05132e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  await drawTrophyWatermark(ctx, W, H);

  const accent = ctx.createLinearGradient(0, 0, W, 0);
  accent.addColorStop(0, "#2563eb");
  accent.addColorStop(1, "#f97316");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 16);

  // logo Palpitô no topo
  const logo = await loadCanvasImage("/logo/logo-apenas-desenho-sem-fundo.svg");
  if (logo) {
    const s = 150;
    ctx.drawImage(logo, (W - s) / 2, 70, s, s);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 70px Arial, sans-serif";
  ctx.fillText("MEUS PALPITES", W / 2, 300);

  ctx.fillStyle = "#9fc0ff";
  ctx.font = "600 42px Arial, sans-serif";
  ctx.fillText(groupName, W / 2, 360);

  const maxRows = 11;
  const shown = predictions.slice(0, maxRows);
  const startY = 470;
  const rowH = 108;

  for (const [i, p] of shown.entries()) {
    const y = startY + i * rowH;
    const x = 90;
    const w = W - 180;
    const homeFlag = await loadCanvasImage(flagImageUrl(p.homeFlagHint ?? p.home, 160) ?? p.homeFlagUrl ?? "");
    const awayFlag = await loadCanvasImage(flagImageUrl(p.awayFlagHint ?? p.away, 160) ?? p.awayFlagUrl ?? "");

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, 92, 24);
    ctx.fill();

    drawFlagBadge(ctx, homeFlag, p.home, x + 28, y + 22, 58, 40);
    drawFlagBadge(ctx, awayFlag, p.away, x + w - 86, y + 22, 58, 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 34px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(fitText(ctx, p.home, 250), x + 100, y + 47);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 42px Arial, sans-serif";
    ctx.fillText(`${p.predictedHome} x ${p.predictedAway}`, W / 2, y + 44);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillText(fitText(ctx, p.away, 250), x + w - 100, y + 47);

    // resultado ao vivo (quando houver)
    if (typeof p.resultHome === "number" && typeof p.resultAway === "number") {
      const live = p.matchStatus === "live" ? "AO VIVO" : p.matchStatus === "finished" ? "FINAL" : "";
      ctx.textAlign = "center";
      ctx.fillStyle = p.matchStatus === "live" ? "#fca5a5" : "#9fc0ff";
      ctx.font = "600 26px Arial, sans-serif";
      ctx.fillText(`Resultado ${p.resultHome} x ${p.resultAway}${live ? "  ·  " + live : ""}`, W / 2, y + 78);
    }
  }

  if (predictions.length > maxRows) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#9fc0ff";
    ctx.font = "600 34px Arial, sans-serif";
    ctx.fillText(`+${predictions.length - maxRows} palpites`, W / 2, startY + maxRows * rowH + 20);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px Arial, sans-serif";
  ctx.fillText(`Total: ${totalPoints} pts`, W / 2, H - 200);

  ctx.fillStyle = "#9fc0ff";
  ctx.font = "600 36px Arial, sans-serif";
  ctx.fillText("Palpitô · Copa do Mundo 2026", W / 2, H - 130);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export function SharePredictions(props: SharePredictionsProps) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const text = buildText(props);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Palpites copiados! Cole no grupo do WhatsApp.");
    } catch {
      toast.error("Nao foi possivel copiar. Selecione o texto manualmente.");
    }
  }

  function sendWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function shareStory() {
    setGenerating(true);
    try {
      const blob = await drawStoryImage(props);
      if (!blob) {
        toast.error("Nao foi possivel gerar a imagem.");
        return;
      }
      const file = new File([blob], "meus-palpites.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Meus palpites", text: `Meus palpites — ${props.groupName}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "meus-palpites.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Imagem salva! Publique no seu story do Instagram.");
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
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={props.predictions.length === 0}
          className={cn(props.triggerClassName)}
        >
          <Share2Icon className="size-4" />
          {props.triggerLabel ?? "Compartilhar palpites"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar meus palpites</DialogTitle>
          <DialogDescription>
            Mande no grupo do WhatsApp como texto, ou gere uma imagem para o seu story do Instagram.
          </DialogDescription>
        </DialogHeader>

        <Textarea readOnly value={text} className="h-40 resize-none text-sm" />

        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={copyText}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copiado" : "Copiar texto"}
          </Button>
          <Button onClick={sendWhatsApp} className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
            <Share2Icon className="size-4" />
            WhatsApp
          </Button>
          <Button onClick={shareStory} disabled={generating}>
            <ImageIcon className="size-4" />
            {generating ? "Gerando..." : "Imagem / Story"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
