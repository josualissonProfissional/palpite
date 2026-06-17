"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Team } from "@/lib/palpite-data";

type PredictionStepperProps = {
  home: Team;
  away: Team;
  initialHome: number;
  initialAway: number;
  onChange?: (value: { home: number; away: number }) => void;
  disabled?: boolean;
};

export function PredictionStepper({
  home,
  away,
  initialHome,
  initialAway,
  onChange,
  disabled,
}: PredictionStepperProps) {
  const [homeScore, setHomeScore] = useState(initialHome);
  const [awayScore, setAwayScore] = useState(initialAway);

  function updateHome(value: number) {
    setHomeScore(value);
    onChange?.({ home: value, away: awayScore });
  }

  function updateAway(value: number) {
    setAwayScore(value);
    onChange?.({ home: homeScore, away: value });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-3">
      <ScoreControl
        label={home.shortName}
        value={homeScore}
        onMinus={() => updateHome(Math.max(0, homeScore - 1))}
        onPlus={() => updateHome(homeScore + 1)}
        disabled={disabled}
      />
      <span className="pb-3 text-xs font-bold text-muted-foreground sm:text-sm">palpite</span>
      <ScoreControl
        label={away.shortName}
        value={awayScore}
        onMinus={() => updateAway(Math.max(0, awayScore - 1))}
        onPlus={() => updateAway(awayScore + 1)}
        disabled={disabled}
      />
    </div>
  );
}

function ScoreControl({
  label,
  value,
  onMinus,
  onPlus,
  disabled,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-white/80 p-1.5 dark:border-white/10 dark:bg-slate-950/60 sm:p-2">
      <div className="mb-2 text-center text-xs font-bold text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={`Diminuir gols de ${label}`}
          onClick={onMinus}
          disabled={disabled || value === 0}
        >
          <MinusIcon className="size-4" />
        </Button>
        <output className="grid h-10 min-w-10 place-items-center rounded-md bg-slate-950 text-xl font-bold tabular-nums text-white sm:h-11 sm:min-w-12 sm:text-2xl">
          {value}
        </output>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={`Aumentar gols de ${label}`}
          onClick={onPlus}
          disabled={disabled}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
