"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrophyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ConfettiBurst,
  createConfettiPieces,
} from "@/components/palpite/confetti-burst";
import {
  BackendLoadingOverlay,
  InlineLoading,
} from "@/components/palpite/backend-loading";

type SavePredictionButtonProps = {
  disabled?: boolean;
  groupId?: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  scoreStatus?: "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
};

export function SavePredictionButton({
  disabled,
  groupId,
  matchId,
  predictedHomeScore,
  predictedAwayScore,
  scoreStatus,
}: SavePredictionButtonProps) {
  const [pieces, setPieces] = useState<ReturnType<typeof createConfettiPieces>>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function getFunctionErrorMessage(error: { message: string; context?: unknown }) {
    const response = error.context instanceof Response ? error.context : null;

    if (response?.status === 423) {
      return "Palpite bloqueado para este jogo.";
    }

    if (response) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);

      if (body && typeof body.error === "string") {
        return body.error;
      }
    }

    return error.message;
  }

  async function handleSave() {
    if (disabled || !groupId) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("save-prediction", {
      body: {
        group_id: groupId,
        match_id: matchId,
        predicted_home_score: predictedHomeScore,
        predicted_away_score: predictedAwayScore,
      },
    });
    setSaving(false);

    if (error) {
      const message = await getFunctionErrorMessage(error);
      toast.error(message);
      return;
    }

    router.refresh();

    if (scoreStatus === "correct") {
      setPieces(createConfettiPieces());
      toast.success("Voce acertou o placar exato!");
      return;
    }

    toast.success("Palpite salvo.");
  }

  return (
    <div className="relative">
      <BackendLoadingOverlay active={saving} label="Salvando palpite..." />
      <ConfettiBurst pieces={pieces} />
      <Button size="sm" disabled={disabled || saving || !groupId} onClick={handleSave}>
        <InlineLoading active={saving} />
        {!saving && <TrophyIcon className="size-4" />}
        {saving ? "Salvando..." : "Salvar palpite"}
      </Button>
    </div>
  );
}
