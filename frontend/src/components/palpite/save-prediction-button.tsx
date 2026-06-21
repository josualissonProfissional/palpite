"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyCheckIcon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  BackendLoadingOverlay,
  InlineLoading,
} from "@/components/palpite/backend-loading";
import { TeamFlag } from "@/components/palpite/team-flag";
import type { Team } from "@/lib/palpite-data";
import { scoreStatusLabel } from "@/lib/score-status-copy";

type SavePredictionButtonProps = {
  disabled?: boolean;
  groupId?: string;
  matchId: string;
  home: Team;
  away: Team;
  predictedHomeScore: number;
  predictedAwayScore: number;
  matchStatus?: "live" | "scheduled" | "finished" | "locked";
  scoreStatus?: "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
};

type ConflictOption = {
  predicted_home_score: number;
  predicted_away_score: number;
  group_names: string[];
};

type SaveAllGroupsResponse = {
  saved?: number;
  total?: number;
  conflict?: boolean;
  options?: ConflictOption[];
};

export function SavePredictionButton({
  disabled,
  groupId,
  matchId,
  home,
  away,
  predictedHomeScore,
  predictedAwayScore,
  matchStatus,
  scoreStatus,
}: SavePredictionButtonProps) {
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictOptions, setConflictOptions] = useState<ConflictOption[]>([]);
  const router = useRouter();

  async function getFunctionErrorMessage(error: { message: string; context?: unknown }) {
    const response = error.context instanceof Response ? error.context : null;

    if (response) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);

      if (body && typeof body.error === "string") {
        return body.error;
      }
    }

    if (response?.status === 423) {
      return "Palpite bloqueado para este jogo.";
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
      toast.success(
        matchStatus === "finished"
          ? "Voce acertou o placar exato!"
          : `${scoreStatusLabel(scoreStatus, matchStatus)} o placar no momento!`,
      );
      return;
    }

    toast.success("Palpite salvo.");
  }

  async function saveForAllGroups(selected?: { home: number; away: number }) {
    if (disabled || !groupId) return;

    setSavingAll(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<SaveAllGroupsResponse>(
      "save-prediction-all-groups",
      {
        body: {
          group_id: groupId,
          match_id: matchId,
          predicted_home_score: selected?.home ?? predictedHomeScore,
          predicted_away_score: selected?.away ?? predictedAwayScore,
          resolve_conflict: Boolean(selected),
        },
      },
    );
    setSavingAll(false);

    if (error) {
      const message = await getFunctionErrorMessage(error);
      toast.error(message);
      return;
    }

    if (data?.conflict && data.options?.length) {
      setConflictOptions(data.options);
      setConflictOpen(true);
      return;
    }

    setConflictOpen(false);
    setConflictOptions([]);
    router.refresh();
    toast.success(`Palpite aplicado em ${data?.saved ?? data?.total ?? 0} grupos.`);
  }

  return (
    <div className="relative w-full">
      <BackendLoadingOverlay
        active={saving || savingAll}
        label={savingAll ? "Aplicando em todos..." : "Salvando palpite..."}
      />
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
        <Button
          size="sm"
          className="w-full"
          disabled={disabled || saving || savingAll || !groupId}
          onClick={handleSave}
        >
          <InlineLoading active={saving} />
          {!saving && <TrophyIcon className="size-4" />}
          {saving ? "Salvando..." : "Salvar palpite"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={disabled || saving || savingAll || !groupId}
          onClick={() => saveForAllGroups()}
        >
          <InlineLoading active={savingAll} />
          {!savingAll && <CopyCheckIcon className="size-4" />}
          {savingAll ? "Aplicando..." : "Usar em todos"}
        </Button>
      </div>
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolha o palpite que vai valer</DialogTitle>
            <DialogDescription>
              Este jogo tem palpites diferentes nos seus grupos. Escolha qual placar deve ficar em todos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border bg-muted/40 p-2">
            <TeamFlag team={home} size="sm" showName className="justify-start" />
            <span className="text-xs font-black uppercase text-muted-foreground">x</span>
            <TeamFlag team={away} size="sm" showName className="justify-end text-right" />
          </div>
          <div className="grid gap-2">
            {conflictOptions.map((option) => (
              <Button
                key={`${option.predicted_home_score}-${option.predicted_away_score}`}
                type="button"
                variant="outline"
                className="h-auto justify-between gap-3 whitespace-normal py-3 text-left"
                disabled={savingAll}
                onClick={() =>
                  saveForAllGroups({
                    home: option.predicted_home_score,
                    away: option.predicted_away_score,
                  })
                }
              >
                <span className="grid min-w-0 flex-1 grid-cols-[auto_auto_auto] items-center justify-start gap-2">
                  <TeamFlag team={home} size="sm" className="justify-start" />
                  <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-base font-black tabular-nums text-white">
                    {option.predicted_home_score} x {option.predicted_away_score}
                  </span>
                  <TeamFlag team={away} size="sm" className="justify-start" />
                </span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground sm:text-right">
                  {option.group_names.join(", ")}
                </span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConflictOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
