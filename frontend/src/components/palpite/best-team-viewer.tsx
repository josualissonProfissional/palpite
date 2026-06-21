"use client";

import { useMemo, useRef, useState } from "react";
import SoccerLineUp, { type Team } from "react-soccer-lineup";
import { toPng } from "html-to-image";
import { DownloadIcon, ImageIcon, PaletteIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countryFlag,
  type BestPlayer,
  type BestPlayerFormation,
  type BestPlayerSelection,
} from "@/lib/palpite-data";

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
  const team = useMemo<Team>(() => {
    const squad: Team["squad"] = { df: [], cm: [], fw: [] };
    for (const { selection, player, stats } of selectedPlayers) {
      const statsLabel = stats ? ` · ${stats.votes}v · ${formatPercentage(stats.percentage)}%` : "";
      const item = {
        name: `${countryFlag(player.teamCountry)} ${player.name}${statsLabel}`,
        number: player.shirtNumber,
      };
      if (selection.selectedRole === "gk") squad.gk = item;
      else if (selection.selectedRole === "df") squad.df!.push(item);
      else if (selection.selectedRole === "mf") squad.cm!.push(item);
      else squad.fw!.push(item);
    }
    return {
      squad,
      style: {
        color: "#f8fafc",
        borderColor: theme.accent,
        numberColor: "#0f172a",
        nameColor: "#0f172a",
        numberBackgroundColor: theme.accent,
        nameBackgroundColor: "rgba(255,255,255,.94)",
        nameOverflow: "ellipsis",
        nameSize: 11,
        size: "medium",
      },
    };
  }, [selectedPlayers, theme.accent]);

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
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border-2 bg-black/10 p-1" style={{ borderColor: theme.accent }}>
          <SoccerLineUp
            size="responsive"
            orientation="vertical"
            color={theme.pitch}
            pattern="lines"
            homeTeam={team}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {selectedPlayers.map(({ selection, player, stats }) => (
            <div key={`${selection.slotIndex}-${player.id}`} className="rounded-xl border bg-white/90 p-2 text-slate-950 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none" aria-label={player.teamName}>{countryFlag(player.teamCountry)}</span>
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
        <Button variant="outline" onClick={handleImage} disabled={generating || !customTitle.trim()}>
          {generating ? <DownloadIcon className="animate-pulse" /> : <ImageIcon />}
          {generating ? "Gerando imagem..." : "Gerar imagem"}
        </Button>
      ) : null}
    </div>
  );
}
