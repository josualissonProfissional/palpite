"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClockIcon, CalendarDaysIcon, Clock3Icon, SaveIcon, TimerIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import type { BestPlayerRules } from "@/lib/palpite-data";

type RoundOption = { name: string; startsAt: string; endsAt: string };

function roundLabel(value: string) {
  const matchday = value.match(/^matchday\s+(\d+)$/i);
  if (matchday) return `${matchday[1]}ª rodada da fase de grupos`;
  const labels: Record<string, string> = {
    "round of 32": "Fase de 32 avos",
    "round of 16": "Oitavas de final",
    "quarter-finals": "Quartas de final",
    "quarter finals": "Quartas de final",
    "semi-finals": "Semifinais",
    "semi finals": "Semifinais",
    "third place": "Disputa do terceiro lugar",
    final: "Final",
  };
  return labels[value.trim().toLowerCase()] ?? value;
}

function shortMoment(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Recife",
  }).format(new Date(value));
}

export function BestPlayerRulesForm({ groupId, rules, canManage }: {
  groupId: string;
  rules: BestPlayerRules;
  canManage: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(rules);
  const [saving, setSaving] = useState(false);
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [roundName, setRoundName] = useState("");
  const [openMode, setOpenMode] = useState<"automatic" | "scheduled">("automatic");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(720);
  const [configuring, setConfiguring] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    (async () => {
      const db = createClient().schema("palpite");
      const { data: group } = await db.from("groups").select("competition_id").eq("id", groupId).maybeSingle();
      if (!group?.competition_id) return;
      const { data } = await db.from("matches")
        .select("round_name,match_date").eq("competition_id", group.competition_id)
        .not("round_name", "is", null).order("match_date");
      if (!active) return;
      const byRound = new Map<string, { dates: string[] }>();
      for (const match of data ?? []) {
        if (!match.round_name) continue;
        const entry = byRound.get(match.round_name) ?? { dates: [] };
        entry.dates.push(match.match_date);
        byRound.set(match.round_name, entry);
      }
      const options = Array.from(byRound, ([name, entry]) => ({
        name,
        startsAt: entry.dates[0],
        endsAt: entry.dates[entry.dates.length - 1],
      }));
      setRounds(options);
      setRoundName((current) => current || options.find((round) => new Date(round.endsAt).getTime() >= Date.now())?.name || options.at(-1)?.name || "");
    })();
    return () => { active = false; };
  }, [canManage, groupId]);

  const selectedRound = useMemo(() => rounds.find((round) => round.name === roundName), [roundName, rounds]);

  async function persistRules() {
    const { data, error } = await createClient().schema("palpite").from("best_player_rules").update({
      daily_voting_enabled: values.dailyVotingEnabled,
      round_team_voting_enabled: values.roundTeamVotingEnabled,
      points_per_average_hit: values.pointsPerAverageHit,
      allow_daily_vote_edit_before_close: values.allowDailyVoteEditBeforeClose,
      allow_round_vote_edit_before_close: values.allowRoundVoteEditBeforeClose,
      respect_player_position: values.respectPlayerPosition,
    }).eq("group_id", groupId).select("group_id").maybeSingle();
    if (error || !data) throw error ?? new Error("Regras não alteradas.");
  }

  async function saveRules() {
    setSaving(true);
    try {
      await persistRules();
      toast.success("Regras dos melhores jogadores salvas.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as regras.");
    } finally {
      setSaving(false);
    }
  }

  async function configureRound() {
    if (!roundName) return toast.error("Escolha uma rodada.");
    if (openMode === "scheduled" && !scheduledAt) return toast.error("Informe a data e o horário de abertura.");
    setConfiguring(true);
    try {
      // The configuration card appears as soon as the switch is enabled locally.
      // Persist the switch first so the Edge Function sees the same state as the UI.
      await persistRules();
      const { error } = await createClient().functions.invoke("configure-round-voting", {
        body: {
          group_id: groupId,
          round_name: roundName,
          open_mode: openMode,
          scheduled_open_at: openMode === "scheduled" ? new Date(scheduledAt).toISOString() : null,
          duration_minutes: duration,
        },
      });
      if (error) throw error;
      toast.success("Time da Rodada ativado e período de votação salvo.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível configurar a rodada.");
    } finally {
      setConfiguring(false);
    }
  }

  const switches: Array<[keyof BestPlayerRules, string, string]> = [
    ["dailyVotingEnabled", "Ativar Time do Dia", "Cria a votação após os jogos de cada dia."],
    ["roundTeamVotingEnabled", "Ativar Time da Rodada", "Permite configurar janelas e distribuir pontos extras."],
    ["allowDailyVoteEditBeforeClose", "Editar Time do Dia", "Permite alterações enquanto a janela estiver aberta."],
    ["allowRoundVoteEditBeforeClose", "Editar Time da Rodada", "Permite alterações antes do fechamento."],
    ["respectPlayerPosition", "Respeitar posição", "Restringe cada jogador à sua faixa original."],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {switches.map(([key, title, description]) => (
          <div key={key} className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 p-3">
            <div><div className="font-semibold">{title}</div><div className="text-xs text-muted-foreground">{description}</div></div>
            <Switch checked={Boolean(values[key])} onCheckedChange={(checked) => setValues((current) => ({ ...current, [key]: checked }))} disabled={!canManage || saving || configuring} />
          </div>
        ))}
        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
          <Label htmlFor="points-per-average-hit">Pontos por jogador acertado</Label>
          <Input id="points-per-average-hit" type="number" min={0} max={100} value={values.pointsPerAverageHit} onChange={(event) => setValues((current) => ({ ...current, pointsPerAverageHit: Number(event.target.value) }))} disabled={!canManage || saving} />
        </div>
      </div>
      {canManage ? <Button onClick={saveRules} disabled={saving || configuring}><SaveIcon />{saving ? "Salvando..." : "Salvar regras dos times"}</Button> : null}

      {canManage && values.roundTeamVotingEnabled ? (
        <div className="space-y-5 rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-background to-emerald-50/70 p-4 shadow-sm dark:from-amber-950/30 dark:via-background dark:to-emerald-950/20 sm:p-5">
          <div>
            <div className="flex items-center gap-2 font-heading text-xl font-bold"><CalendarClockIcon className="text-amber-600" />Período de votação — Time da Rodada</div>
            <p className="mt-1 text-sm text-muted-foreground">Escolha quando o grupo poderá montar o time. A votação só será liberada depois que todos os jogos terminarem.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="best-round">Qual rodada?</Label>
              <Select value={roundName} onValueChange={setRoundName}>
                <SelectTrigger id="best-round" className="h-11 w-full bg-background shadow-sm"><SelectValue placeholder="Selecione a rodada" /></SelectTrigger>
                <SelectContent position="popper" align="start">
                  {rounds.map((round) => <SelectItem key={round.name} value={round.name}>{roundLabel(round.name)} · termina {shortMoment(round.endsAt)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="best-open-mode">Quando liberar?</Label>
              <Select value={openMode} onValueChange={(value) => setOpenMode(value as typeof openMode)}>
                <SelectTrigger id="best-open-mode" className="h-11 w-full bg-background shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value="automatic">Assim que todos os jogos terminarem</SelectItem>
                  <SelectItem value="scheduled">No dia e horário que eu escolher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedRound ? (
              <div className="flex items-center gap-3 rounded-xl border bg-background/80 p-3 text-sm md:col-span-2">
                <CalendarDaysIcon className="size-5 shrink-0 text-emerald-600" />
                <div><div className="font-semibold">{roundLabel(selectedRound.name)}</div><div className="text-xs text-muted-foreground">Jogos entre {shortMoment(selectedRound.startsAt)} e {shortMoment(selectedRound.endsAt)}</div></div>
              </div>
            ) : null}
            {openMode === "scheduled" ? <div className="space-y-2"><Label htmlFor="best-scheduled-at">Dia e horário de abertura</Label><div className="relative"><Clock3Icon className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="best-scheduled-at" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="h-11 pl-9" /></div></div> : null}
            <div className="space-y-2">
              <Label htmlFor="best-duration">Quanto tempo ficará aberto?</Label>
              <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
                <SelectTrigger id="best-duration" className="h-11 w-full bg-background shadow-sm"><TimerIcon className="text-amber-600" /><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value="720">12 horas para votar</SelectItem>
                  <SelectItem value="1440">24 horas para votar</SelectItem>
                  <SelectItem value="2880">48 horas para votar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={configureRound} disabled={configuring}><CalendarClockIcon />{configuring ? "Salvando..." : "Ativar e salvar período"}</Button>
        </div>
      ) : null}
    </div>
  );
}
