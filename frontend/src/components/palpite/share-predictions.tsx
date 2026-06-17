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

export type SharePrediction = {
  home: string;
  away: string;
  predictedHome: number;
  predictedAway: number;
  status?: "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
  points?: number;
};

type SharePredictionsProps = {
  groupName: string;
  predictions: SharePrediction[];
  totalPoints: number;
};

const statusEmoji: Record<NonNullable<SharePrediction["status"]>, string> = {
  correct: "🟢",
  partial: "🟡",
  wrong: "🔴",
  inverse_penalty: "🔴",
  pending: "⚪",
};

function buildText({ groupName, predictions, totalPoints }: SharePredictionsProps) {
  const lines = predictions.map((p) => {
    const dot = p.status ? `${statusEmoji[p.status]} ` : "⚽ ";
    return `${dot}${p.home} ${p.predictedHome} x ${p.predictedAway} ${p.away}`;
  });
  return [
    `🏆 Meus palpites — ${groupName}`,
    "",
    ...lines,
    "",
    `Total: ${totalPoints} pts`,
    "Feito no Palpite · Copa do Mundo 2026",
  ].join("\n");
}

function drawStoryImage({ groupName, predictions, totalPoints }: SharePredictionsProps): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  // fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1f4d");
  bg.addColorStop(1, "#05132e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faixa superior
  const accent = ctx.createLinearGradient(0, 0, W, 0);
  accent.addColorStop(0, "#2563eb");
  accent.addColorStop(1, "#f97316");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 16);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 76px Arial, sans-serif";
  ctx.fillText("MEUS PALPITES", W / 2, 220);

  ctx.fillStyle = "#9fc0ff";
  ctx.font = "600 44px Arial, sans-serif";
  ctx.fillText(groupName, W / 2, 290);

  // lista
  const maxRows = 12;
  const shown = predictions.slice(0, maxRows);
  const startY = 420;
  const rowH = 104;
  ctx.textAlign = "left";

  shown.forEach((p, i) => {
    const y = startY + i * rowH;
    // cartao da linha
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    const x = 90;
    const w = W - 180;
    const r = 24;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 80, r);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 40px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(p.home, x + 36, y + 52);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 44px Arial, sans-serif";
    ctx.fillText(`${p.predictedHome} x ${p.predictedAway}`, W / 2, y + 52);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 40px Arial, sans-serif";
    ctx.fillText(p.away, x + w - 36, y + 52);
  });

  if (predictions.length > maxRows) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#9fc0ff";
    ctx.font = "600 36px Arial, sans-serif";
    ctx.fillText(`+${predictions.length - maxRows} palpites`, W / 2, startY + maxRows * rowH + 30);
  }

  // total
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 60px Arial, sans-serif";
  ctx.fillText(`Total: ${totalPoints} pts`, W / 2, H - 220);

  ctx.fillStyle = "#9fc0ff";
  ctx.font = "600 38px Arial, sans-serif";
  ctx.fillText("Palpite · Copa do Mundo 2026", W / 2, H - 150);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export function SharePredictions(props: SharePredictionsProps) {
  const [open, setOpen] = useState(false);
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

      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Meus palpites",
          text: `Meus palpites — ${props.groupName}`,
        });
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
      // usuario pode cancelar o compartilhamento — nao tratamos como erro
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error("Nao foi possivel compartilhar a imagem.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={props.predictions.length === 0}>
          <Share2Icon className="size-4" />
          Compartilhar palpites
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
