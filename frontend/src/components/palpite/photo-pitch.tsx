"use client";

import { useMemo } from "react";
import { countryFlag, type BestPlayer, type BestPlayerFormation, type BestPlayerSelection } from "@/lib/palpite-data";

type FormationSlot = { x: number; y: number; role: "gk" | "df" | "mf" | "fw" };

function formationSlots(formation: BestPlayerFormation): FormationSlot[] {
  const fieldWidth = 360;
  const fieldHeight = 520;
  const marginX = 24;
  const usableWidth = fieldWidth - marginX * 2;

  const gkY = fieldHeight - 28;
  const dfY = fieldHeight - 100;
  const mfY = fieldHeight - 190;
  const fwY = fieldHeight - 280;

  const slots: FormationSlot[] = [{ x: fieldWidth / 2, y: gkY, role: "gk" }];

  function distribute(count: number, y: number, role: FormationSlot["role"]) {
    if (count === 0) return;
    if (count === 1) { slots.push({ x: fieldWidth / 2, y, role }); return; }
    const step = usableWidth / (count - 1);
    for (let i = 0; i < count; i++) {
      slots.push({ x: marginX + i * step, y, role });
    }
  }

  switch (formation) {
    case "4-3-3": distribute(4, dfY, "df"); distribute(3, mfY, "mf"); distribute(3, fwY, "fw"); break;
    case "4-4-2": distribute(4, dfY, "df"); distribute(4, mfY, "mf"); distribute(2, fwY, "fw"); break;
    case "3-5-2": distribute(3, dfY, "df"); distribute(5, mfY, "mf"); distribute(2, fwY, "fw"); break;
    case "free-11": distribute(4, dfY, "df"); distribute(3, mfY, "mf"); distribute(3, fwY, "fw"); break;
  }

  return slots;
}

function roleColor(role: string) {
  switch (role) {
    case "gk": return "#facc15";
    case "df": return "#3b82f6";
    case "mf": return "#22c55e";
    case "fw": return "#ef4444";
    default: return "#94a3b8";
  }
}

type PhotoPitchProps = {
  formation: BestPlayerFormation;
  players: BestPlayer[];
  selections: BestPlayerSelection[];
  pitchColor?: string;
  accentColor?: string;
  playerStats?: Record<string, { votes: number; percentage: number }>;
  correctPlayerIds?: Set<string>;
};

export function PhotoPitch({ formation, players, selections, pitchColor = "#138a55", accentColor = "#fbbf24", playerStats, correctPlayerIds }: PhotoPitchProps) {
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const slots = useMemo(() => formationSlots(formation), [formation]);

  const assigned = useMemo(() => {
    const sorted = [...selections].sort((a, b) => a.slotIndex - b.slotIndex);
    const result: Array<{ slot: FormationSlot; player: BestPlayer; stats?: { votes: number; percentage: number } }> = [];
    for (let i = 0; i < Math.min(sorted.length, slots.length); i++) {
      const selection = sorted[i];
      const player = playerById.get(selection.playerId);
      if (player) {
        result.push({ slot: slots[i], player, stats: playerStats?.[player.id] });
      }
    }
    return result;
  }, [slots, selections, playerById, playerStats]);

  const darkerPitch = pitchColor.replace("#", "");
  const r = Math.max(0, parseInt(darkerPitch.slice(0, 2), 16) - 20);
  const g = Math.max(0, parseInt(darkerPitch.slice(2, 4), 16) - 20);
  const b = Math.max(0, parseInt(darkerPitch.slice(4, 6), 16) - 20);
  const lineColor = `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;

  return (
    <svg viewBox="0 0 360 520" className="w-full max-w-[360px] mx-auto" style={{ fontFamily: "system-ui, sans-serif" }}>
      <defs>
        <clipPath id="pitch-clip-p">
          <rect x="4" y="4" width="352" height="512" rx="8" />
        </clipPath>
      </defs>
      <rect x="2" y="2" width="356" height="516" rx="10" fill={accentColor} />
      <rect x="4" y="4" width="352" height="512" rx="8" fill={pitchColor} />
      <rect x="4" y="4" width="352" height="512" rx="8" fill="url(#pitch-stripes-p)" opacity="0.12" />
      <rect x="4" y="4" width="352" height="512" rx="8" fill="none" stroke={lineColor} strokeWidth="1.5" />
      <line x1="4" y1="260" x2="356" y2="260" stroke={lineColor} strokeWidth="1.5" />
      <circle cx="180" cy="260" r="45" fill="none" stroke={lineColor} strokeWidth="1.5" />
      <rect x="120" y="4" width="120" height="70" rx="4" fill="none" stroke={lineColor} strokeWidth="1.5" />
      <rect x="120" y="446" width="120" height="70" rx="4" fill="none" stroke={lineColor} strokeWidth="1.5" />
      <rect x="154" y="4" width="52" height="28" rx="2" fill="none" stroke={lineColor} strokeWidth="1.5" />
      <rect x="154" y="488" width="52" height="28" rx="2" fill="none" stroke={lineColor} strokeWidth="1.5" />
      <circle cx="180" cy="260" r="2" fill={lineColor} />
      <circle cx="118" y="260" r="1" fill={lineColor} />
      <circle cx="242" y="260" r="1" fill={lineColor} />
      <circle cx="118" y="128" r="1" fill={lineColor} />
      <circle cx="242" y="128" r="1" fill={lineColor} />

      {assigned.map(({ slot, player, stats }, i) => {
        const outerR = 22;
        const innerR = 20;
        const roleColorHex = roleColor(slot.role);

        return (
          <g key={i}>
            <circle cx={slot.x} cy={slot.y} r={outerR + 2} fill="rgba(0,0,0,0.25)" />
            <clipPath id={`pclip-p-${i}`}>
              <circle cx={slot.x} cy={slot.y} r={innerR} />
            </clipPath>
            {player.photoUrl ? (
              <image href={player.photoUrl} x={slot.x - innerR} y={slot.y - innerR} width={innerR * 2} height={innerR * 2} clipPath={`url(#pclip-p-${i})`} preserveAspectRatio="xMidYMid slice" />
            ) : (
              <circle cx={slot.x} cy={slot.y} r={innerR} fill="#334155" />
            )}
            <circle cx={slot.x} cy={slot.y} r={innerR} fill="none" stroke={roleColorHex} strokeWidth="2" />
            {correctPlayerIds?.has(player.id) ? (
              <>
                <circle cx={slot.x} cy={slot.y - innerR + 4} r="7" fill="#22c55e" stroke="#fff" strokeWidth="1" />
                <text x={slot.x} y={slot.y - innerR + 5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="9" fontWeight="bold">✓</text>
              </>
            ) : null}
            {!player.photoUrl && (
              <text x={slot.x} y={slot.y + 1} textAnchor="middle" dominantBaseline="central" fill="#f8fafc" fontSize="8" fontWeight="bold">
                {countryFlag(player.teamCountry)}
              </text>
            )}
            <rect x={slot.x - 30} y={slot.y + outerR + 3} width="60" height="16" rx="3" fill="rgba(0,0,0,0.7)" />
            <text x={slot.x} y={slot.y + outerR + 9} textAnchor="middle" dominantBaseline="central" fill="#f8fafc" fontSize="7" fontWeight="bold" style={{ textTransform: "uppercase" }}>
              {player.name.length > 12 ? player.name.slice(0, 11) + "…" : player.name}
            </text>
            {stats && (
              <rect x={slot.x - 20} y={slot.y + outerR + 21} width="40" height="12" rx="2" fill={accentColor} opacity="0.9" />
            )}
            {stats && (
              <text x={slot.x} y={slot.y + outerR + 29} textAnchor="middle" dominantBaseline="central" fill="#0f172a" fontSize="7" fontWeight="bold">
                {stats.votes}v · {stats.percentage}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
