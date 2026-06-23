"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronUpIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ["Autor do gol", "goal_scorer_points", "goalScorerPoints"],
  ["Assistência", "goal_assist_points", "goalAssistPoints"],
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
  const [goalAssistMode, setGoalAssistMode] = useState(rules.goalAssistScoringMode);

  function adjustValue(column: string, delta: number) {
    setValues((current) => {
      const value = Number(current[column]) || 0;
      return { ...current, [column]: String(Math.round((value + delta) * 100) / 100) };
    });
  }

  async function handleSave() {
    if (!groupId) {
      toast.error("Grupo nao identificado.");
      return;
    }

    const payload: Record<string, number | boolean | string> = {
      allow_negative_score: allowNegative,
      goal_assist_scoring_mode: goalAssistMode,
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
      {NUMERIC_FIELDS.map(([label, column]) => {
        const decimal = column === "goal_scorer_points" || column === "goal_assist_points";
        return (
        <div key={column} className="space-y-2">
          <Label htmlFor={column}>{label}</Label>
          <div className="grid grid-cols-[auto_1fr_auto] overflow-hidden rounded-md border bg-background">
            <Button type="button" variant="ghost" size="icon" className="rounded-none border-r" onClick={() => adjustValue(column, decimal ? -0.1 : -1)} disabled={saving} aria-label={`Diminuir ${label}`}><ChevronDownIcon /></Button>
            <Input id={column} inputMode={decimal ? "decimal" : "numeric"} value={values[column]} onChange={(event) => setValues((prev) => ({ ...prev, [column]: event.target.value.replace(",", ".") }))} disabled={saving} className="rounded-none border-0 text-center text-base font-bold shadow-none focus-visible:ring-0" />
            <Button type="button" variant="ghost" size="icon" className="rounded-none border-l" onClick={() => adjustValue(column, decimal ? 0.1 : 1)} disabled={saving} aria-label={`Aumentar ${label}`}><ChevronUpIcon /></Button>
          </div>
        </div>
      )})}
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
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="goal-assist-mode">Como pontuar gol e assistência</Label>
        <Select value={goalAssistMode} onValueChange={(value) => setGoalAssistMode(value as "separate" | "pair_only")} disabled={saving}>
          <SelectTrigger id="goal-assist-mode"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="separate">Pontuar autor e assistência separadamente</SelectItem>
            <SelectItem value="pair_only">Pontuar apenas a dupla exata</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button className="md:col-span-2" onClick={handleSave} disabled={saving}>
        <InlineLoading active={saving} />
        {!saving && <SaveIcon className="size-4" />}
        {saving ? "Salvando..." : "Salvar regras"}
      </Button>
    </div>
  );
}
