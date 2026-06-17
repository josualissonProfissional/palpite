"use client";

import { cn } from "@/lib/utils";

const colors = ["#2563eb", "#f97316", "#16a34a", "#f59e0b", "#dc2626"];

type Piece = {
  id: number;
  left: number;
  delay: number;
  color: string;
  rotate: number;
};

export function createConfettiPieces(): Piece[] {
  return Array.from({ length: 32 }, (_, index) => ({
    id: Date.now() + index,
    left: 8 + Math.random() * 84,
    delay: Math.random() * 0.24,
    color: colors[index % colors.length],
    rotate: Math.random() * 180,
  }));
}

export function ConfettiBurst({ pieces }: { pieces: Piece[] }) {
  if (pieces.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-40 overflow-hidden"
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={cn(
            "absolute top-0 h-3 w-2 rounded-[2px]",
            "motion-safe:animate-[confetti-fall_1.05s_ease-out_forwards]"
          )}
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            transform: `rotate(${piece.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
