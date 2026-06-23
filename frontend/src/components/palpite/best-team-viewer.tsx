"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { CopyIcon, DownloadIcon, ImageIcon, PaletteIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countryFlag,
  type BestPlayer,
  type BestPlayerFormation,
  type BestPlayerSelection,
} from "@/lib/palpite-data";
import { PhotoPitch } from "@/components/palpite/lazy";

export type BestTeamPlayerStats = Record<string, { votes: number; percentage: number }>;

type VisualTheme = "classic" | "night" | "gold";

const themes: Record<VisualTheme, {
  label: string;
  pitch: string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
}> = {
  classic: {
    label: "Clássico",
    pitch: "#138a55",
    surface: "linear-gradient(135deg,#fffbeb 0%,#ffffff 48%,#ecfdf5 100%)",
    accent: "#fbbf24",
    text: "#0f172a",
    muted: "#475569",
  },
  night: {
    label: "Noturno",
    pitch: "#07543a",
    surface: "linear-gradient(135deg,#020617 0%,#172033 50%,#052e2b 100%)",
    accent: "#38bdf8",
    text: "#f8fafc",
    muted: "#cbd5e1",
  },
  gold: {
    label: "Dourado",
    pitch: "#17623f",
    surface: "linear-gradient(135deg,#1c1917 0%,#422006 50%,#14532d 100%)",
    accent: "#facc15",
    text: "#fefce8",
    muted: "#fde68a",
  },
};

function formatPercentage(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

type BestTeamViewerProps = {
  title: string;
  formation: BestPlayerFormation;
  players: BestPlayer[];
  selections: BestPlayerSelection[];
  subtitle?: string;
  ownerName?: string;
  score?: { hits: number; points: number };
  playerStats?: BestTeamPlayerStats;
  shareable?: boolean;
  correctPlayerIds?: Set<string>;
};

export function BestTeamViewer({
  title,
  formation,
  players,
  selections,
  subtitle,
  ownerName,
  score,
  playerStats,
  shareable = true,
  correctPlayerIds,
}: BestTeamViewerProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [customTitle, setCustomTitle] = useState(title);
  const [themeName, setThemeName] = useState<VisualTheme>("night");
  const theme = themes[themeName];
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const selectedPlayers = useMemo(() => selections
    .slice()
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .flatMap((selection) => {
      const player = playerById.get(selection.playerId);
      return player ? [{ selection, player, stats: playerStats?.[player.id] }] : [];
    }), [playerById, playerStats, selections]);

  async function handleImage() {
    if (!captureRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(captureRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `${customTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Não foi possível gerar a imagem deste time.");
    } finally {
      setGenerating(false);
    }
  }
  function buildShareText() {
    const roleLabels: Record<string, string> = { gk: "GOL", df: "DEF", mf: "MEI", fw: "ATA" };
    const sorted = [...selections].sort((a, b) => a.slotIndex - b.slotIndex);
    const lines = sorted.flatMap((s) => {
      const p = playerById.get(s.playerId);
      return p ? [`${countryFlag(p.teamCountry)} ${p.name} (${roleLabels[s.selectedRole] ?? s.selectedRole})`] : [];
    });
    const header = `${customTitle}${ownerName ? ` — ${ownerName}` : ""}`;
    const meta = [`Formação: ${formation}`, subtitle ? `Data: ${subtitle}` : null, score ? `${score.hits} acertos · ${score.points} pts` : null].filter(Boolean).join(" · ");
    return [header, meta, "", ...lines, "", "Montado no Palpitô ✦ palpitô.shop"].join("\n");
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast.success("Time copiado!");
    } catch {
      toast.error("Não foi possível copiar o texto.");
    }
  }

  return (
    <div className="space-y-3">
      {shareable ? (
        <div className="grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`team-title-${title}`}>Título da imagem</Label>
            <Input
              id={`team-title-${title}`}
              value={customTitle}
              maxLength={60}
              onChange={(event) => setCustomTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Tema da escalação">
            {Object.entries(themes).map(([value, item]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={themeName === value ? "default" : "outline"}
                onClick={() => setThemeName(value as VisualTheme)}
              >
                <PaletteIcon />{item.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        ref={captureRef}
        className="overflow-hidden rounded-3xl border-4 p-4 shadow-xl sm:p-6"
        style={{ background: theme.surface, borderColor: theme.accent, color: theme.text }}
      >
        <div className="mb-4 text-center">
          <div className="font-heading text-2xl font-black">{customTitle}</div>
          {ownerName ? <div className="mt-1 text-sm font-bold" style={{ color: theme.muted }}>{ownerName}</div> : null}
          <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
            {formation}{subtitle ? ` · ${subtitle}` : ""}
          </div>
          {score ? (
            <div className="mx-auto mt-3 flex w-fit gap-4 rounded-full border px-4 py-2 text-sm font-black" style={{ borderColor: theme.accent }}>
              <span>{score.hits} acertos</span><span>{score.points} pontos</span>
            </div>
          ) : null}
        </div>
        <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border-2 bg-black/10 p-2" style={{ borderColor: theme.accent }}>
          <PhotoPitch
            formation={formation}
            players={players}
            selections={selections}
            pitchColor={theme.pitch}
            accentColor={theme.accent}
            correctPlayerIds={correctPlayerIds}
            playerStats={playerStats}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {selectedPlayers.map(({ selection, player, stats }) => (
            <div key={`${selection.slotIndex}-${player.id}`} className="rounded-xl border bg-white/90 p-2 text-slate-950 shadow-sm">
              <div className="flex items-start gap-2">
                <Avatar size="sm" className="size-8"><AvatarImage src={player.photoUrl} alt={player.name} /><AvatarFallback>{countryFlag(player.teamCountry)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <div className="truncate text-xs font-black">{player.name}</div>
                  <div className="truncate text-[10px] font-semibold text-slate-500">{player.teamName}</div>
                </div>
              </div>
              {stats ? (
                <div className="mt-2 flex items-center justify-between rounded-lg px-2 py-1 text-[10px] font-black" style={{ backgroundColor: theme.accent }}>
                  <span>{stats.votes} {stats.votes === 1 ? "voto" : "votos"}</span><span>{formatPercentage(stats.percentage)}%</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-4 text-center text-xs font-bold" style={{ color: theme.muted }}>
          Palpitô · Copa do Mundo 2026
        </div>
      </div>
      {shareable ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleImage} disabled={generating || !customTitle.trim()}>
            {generating ? <DownloadIcon className="animate-pulse" /> : <ImageIcon />}
            {generating ? "Gerando imagem..." : "Gerar imagem"}
          </Button>
          <Button variant="outline" onClick={handleCopyText} disabled={!customTitle.trim()}>
            <CopyIcon />
            Copiar texto
          </Button>
        </div>
      ) : null}
    </div>
  );
}
