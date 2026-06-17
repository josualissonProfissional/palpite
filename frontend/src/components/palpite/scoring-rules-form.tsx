"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import type { ScoringRules } from "@/lib/palpite-data";
import {
  BackendLoadingOverlay,
  InlineLoading,
} from "@/components/palpite/backend-loading";

type ScoringRulesFormProps = {
  groupId?: string;
  rules: ScoringRules;
};

const NUMERIC_FIELDS = [
  ["Placar exato", "exact_score_points", "exactScorePoints"],
  ["Vencedor", "correct_winner_points", "correctWinnerPoints"],
  ["Empate", "correct_draw_points", "correctDrawPoints"],
  ["Gol mandante", "correct_goal_home_points", "correctGoalHomePoints"],
  ["Gol visitante", "correct_goal_away_points", "correctGoalAwayPoints"],
  ["Penalidade inversa", "inverse_score_penalty", "inverseScorePenalty"],
] as const;

export function ScoringRulesForm({ groupId, rules }: ScoringRulesFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      NUMERIC_FIELDS.map(([, column, key]) => [column, String(rules[key])])
    )
  );
  const [allowNegative, setAllowNegative] = useState(rules.allowNegativeScore);

  async function handleSave() {
    if (!groupId) {
      toast.error("Grupo nao identificado.");
      return;
    }

    const payload: Record<string, number | boolean> = {
      allow_negative_score: allowNegative,
    };
    for (const [, column] of NUMERIC_FIELDS) {
      const parsed = Number(values[column]);
      if (!Number.isFinite(parsed)) {
        toast.error("Preencha todos os pontos com numeros validos.");
        return;
      }
      payload[column] = parsed;
    }

    setSaving(true);
    const { error } = await createClient()
      .schema("palpite")
      .from("scoring_rules")
      .update(payload)
      .eq("group_id", groupId);
    setSaving(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("row-level")
          ? "Apenas o dono ou administradores podem alterar as regras."
          : error.message
      );
      return;
    }

    toast.success("Regras salvas.");
    router.refresh();
  }

  return (
    <div className="relative grid gap-4 md:grid-cols-2" aria-busy={saving}>
      <BackendLoadingOverlay active={saving} label="Salvando regras..." />
      {NUMERIC_FIELDS.map(([label, column]) => (
        <div key={column} className="space-y-2">
          <Label htmlFor={column}>{label}</Label>
          <Input
            id={column}
            inputMode="numeric"
            value={values[column]}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, [column]: event.target.value }))
            }
            disabled={saving}
          />
        </div>
      ))}
      <div className="flex flex-col gap-3 rounded-lg border bg-white/70 p-3 md:col-span-2 md:flex-row md:items-center md:justify-between dark:bg-slate-950/60">
        <div>
          <div className="font-semibold">Permitir pontuacao negativa</div>
          <div className="text-sm text-muted-foreground">
            Participantes podem perder pontos em palpites errados.
          </div>
        </div>
        <Switch
          checked={allowNegative}
          onCheckedChange={setAllowNegative}
          disabled={saving}
        />
      </div>
      <Button className="md:col-span-2" onClick={handleSave} disabled={saving}>
        <InlineLoading active={saving} />
        {!saving && <SaveIcon className="size-4" />}
        {saving ? "Salvando..." : "Salvar regras"}
      </Button>
    </div>
  );
}
