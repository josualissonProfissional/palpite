"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CopyCheckIcon, GoalIcon, HandshakeIcon, TrophyIcon, UserRoundPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { countryFlag, type Team } from "@/lib/palpite-data";
import { scoreStatusLabel } from "@/lib/score-status-copy";

type SavePredictionButtonProps = {
  disabled?: boolean;
  groupId?: string;
  matchId: string;
  home: Team;
  away: Team;
  predictedHomeScore: number;
  predictedAwayScore: number;
  matchStatus?: "live" | "scheduled" | "finished" | "locked" | "suspended";
  scoreStatus?: "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
  hasGoalSelections?: boolean;
  hasExistingPrediction?: boolean;
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

type PlayerOption = {
  id: string;
  name: string;
  team_id: string;
  position: string;
  shirt_number: number | null;
  photo_url: string | null;
};

type GoalSelection = {
  teamId: string;
  goalIndex: number;
  scorerPlayerId: string | null;
  assistPlayerId: string | null | undefined;
  isOwnGoal: boolean;
};

type WizardMode = "single" | "all";
type PredictionScores = { home: number; away: number };

const positionLabel: Record<string, string> = { gk: "Goleiro", df: "Defesa", mf: "Meio-campo", fw: "Atacante" };

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
  hasGoalSelections = false,
  hasExistingPrediction = false,
}: SavePredictionButtonProps) {
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictOptions, setConflictOptions] = useState<ConflictOption[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardTab, setWizardTab] = useState<"scorer" | "assist">("scorer");
  const [playerPage, setPlayerPage] = useState(0);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [goalSelections, setGoalSelections] = useState<GoalSelection[]>([]);
  const [wizardMode, setWizardMode] = useState<WizardMode>("single");
  const [wizardScores, setWizardScores] = useState<PredictionScores>({
    home: predictedHomeScore,
    away: predictedAwayScore,
  });
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

  const activeSelection = goalSelections[wizardStep];
  const activeTeam = activeSelection?.teamId === home.id ? home : away;
  const opposingTeam = activeSelection?.teamId === home.id ? away : home;
  const scorerCandidates = players.filter((player) => player.team_id === (activeSelection?.isOwnGoal ? opposingTeam.id : activeTeam.id));
  const assistCandidates = players.filter((player) => player.team_id === activeTeam.id);
  const candidates = wizardTab === "scorer" ? scorerCandidates : assistCandidates;
  const playerPageSize = 6;
  const totalPlayerPages = Math.max(1, Math.ceil(candidates.length / playerPageSize));
  const safePlayerPage = Math.min(playerPage, totalPlayerPages - 1);
  const visiblePlayers = candidates.slice(safePlayerPage * playerPageSize, (safePlayerPage + 1) * playerPageSize);

  function updateActiveSelection(update: Partial<GoalSelection>) {
    setGoalSelections((current) => current.map((selection, index) => index === wizardStep ? { ...selection, ...update } : selection));
  }

  async function handleSave(selections: GoalSelection[], scores: PredictionScores = { home: predictedHomeScore, away: predictedAwayScore }) {
    if (disabled || !groupId) return false;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("save-prediction", {
      body: {
        group_id: groupId,
        match_id: matchId,
        predicted_home_score: scores.home,
        predicted_away_score: scores.away,
        goal_selections: selections.map((selection) => ({
          team_id: selection.teamId,
          goal_index: selection.goalIndex,
          scorer_player_id: selection.scorerPlayerId,
          assist_player_id: selection.assistPlayerId,
          is_own_goal: selection.isOwnGoal,
        })),
      },
    });
    setSaving(false);

    if (error) {
      const message = await getFunctionErrorMessage(error);
      toast.error(message);
      return false;
    }

    router.refresh();

    if (scoreStatus === "correct") {
      toast.success(
        matchStatus === "finished"
          ? "Voce acertou o placar exato!"
          : `${scoreStatusLabel(scoreStatus, matchStatus)} o placar no momento!`,
      );
      return true;
    }

    toast.success("Palpite salvo.");
    return true;
  }

  async function openWizard(mode: WizardMode = "single", scores: PredictionScores = { home: predictedHomeScore, away: predictedAwayScore }) {
    if (disabled || !groupId || !home.id || !away.id) return;
    setWizardMode(mode);
    setWizardScores(scores);
    const totalGoals = scores.home + scores.away;
    if (totalGoals === 0) {
      if (mode === "single") await handleSave([], scores);
      return;
    }

    setWizardLoading(true);
    const supabase = createClient();
    const [{ data: playerRows, error: playersError }, { data: authData }] = await Promise.all([
      supabase.schema("palpite").from("players").select("id,name,team_id,position,shirt_number,photo_url").in("team_id", [home.id, away.id]).order("name"),
      supabase.auth.getUser(),
    ]);
    if (playersError || !authData.user) {
      setWizardLoading(false);
      toast.error(playersError?.message ?? "Não foi possível carregar os jogadores.");
      return;
    }

    const { data: prediction } = await supabase.schema("palpite").from("predictions")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", authData.user.id)
      .eq("match_id", matchId)
      .maybeSingle();
    const { data: savedSelections } = prediction
      ? await supabase.schema("palpite").from("prediction_goal_selections")
        .select("team_id,goal_index,scorer_player_id,assist_player_id,is_own_goal")
        .eq("prediction_id", prediction.id)
      : { data: [] };

    const previous = new Map((savedSelections ?? []).map((selection) => [`${selection.team_id}:${selection.goal_index}`, selection]));
    setPlayers((playerRows ?? []) as PlayerOption[]);
    const steps = [
      ...Array.from({ length: scores.home }, (_, index) => ({ teamId: home.id!, goalIndex: index + 1, scorerPlayerId: null, assistPlayerId: undefined, isOwnGoal: false })),
      ...Array.from({ length: scores.away }, (_, index) => ({ teamId: away.id!, goalIndex: index + 1, scorerPlayerId: null, assistPlayerId: undefined, isOwnGoal: false })),
    ];
    setGoalSelections(steps.map((selection) => {
      const saved = previous.get(`${selection.teamId}:${selection.goalIndex}`);
      return saved ? {
        ...selection,
        scorerPlayerId: saved.scorer_player_id,
        assistPlayerId: saved.assist_player_id,
        isOwnGoal: saved.is_own_goal,
      } : selection;
    }));
    setWizardStep(0);
    setWizardTab("scorer");
    setPlayerPage(0);
    setWizardOpen(true);
    setWizardLoading(false);
  }

  async function confirmWizard() {
    if (goalSelections.some((selection) => !selection.scorerPlayerId || (!selection.isOwnGoal && selection.assistPlayerId === undefined))) return;
    const saved = wizardMode === "all"
      ? await saveForAllGroups({ scores: wizardScores, goalSelections })
      : await handleSave(goalSelections, wizardScores);
    if (saved) setWizardOpen(false);
  }

  async function saveForAllGroups(options: { scores?: PredictionScores; goalSelections?: GoalSelection[] } = {}) {
    if (disabled || !groupId) return;

    setSavingAll(true);
    const supabase = createClient();
    const scores = options.scores ?? { home: predictedHomeScore, away: predictedAwayScore };
    const { data, error } = await supabase.functions.invoke<SaveAllGroupsResponse>(
      "save-prediction-all-groups",
      {
        body: {
          group_id: groupId,
          match_id: matchId,
          predicted_home_score: scores.home,
          predicted_away_score: scores.away,
          resolve_conflict: Boolean(options.scores || options.goalSelections),
          ...(options.goalSelections ? {
            goal_selections: options.goalSelections.map((selection) => ({
              team_id: selection.teamId,
              goal_index: selection.goalIndex,
              scorer_player_id: selection.scorerPlayerId,
              assist_player_id: selection.assistPlayerId,
              is_own_goal: selection.isOwnGoal,
            })),
          } : {}),
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
      return false;
    }

    setConflictOpen(false);
    setConflictOptions([]);
    router.refresh();
    if (options.goalSelections) {
      toast.success(`Palpite com gols e assistências aplicado em ${data?.saved ?? data?.total ?? 0} grupos.`);
      return true;
    }
    if (scores.home + scores.away > 0) {
      toast.success(`Placar aplicado em ${data?.saved ?? data?.total ?? 0} grupos. Agora indique os gols e assistências.`);
      await openWizard("all", scores);
      return false;
    }
    toast.success(`Palpite aplicado em ${data?.saved ?? data?.total ?? 0} grupos.`);
    return true;
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
          disabled={disabled || saving || savingAll || wizardLoading || !groupId}
          onClick={() => void openWizard()}
        >
          <InlineLoading active={saving} />
          {!saving && <TrophyIcon className="size-4" />}
          {saving ? "Salvando..." : wizardLoading ? "Preparando..." : "Salvar palpite"}
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
        {hasExistingPrediction && !hasGoalSelections && predictedHomeScore + predictedAwayScore > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 sm:col-span-2 dark:bg-amber-950/30 dark:text-amber-100"
            disabled={disabled || saving || savingAll || wizardLoading || !groupId}
            onClick={() => void openWizard()}
          >
            <UserRoundPlusIcon className="size-4" />
            Adicione quem vai fazer gol e dar assistência
          </Button>
        ) : null}
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
                  scores: {
                    home: option.predicted_home_score,
                    away: option.predicted_away_score,
                  },
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
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!saving && !savingAll) setWizardOpen(open); }}>
        <DialogContent className="flex h-[min(680px,92svh)] max-w-2xl flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>{wizardMode === "all" ? "Complete o palpite para todos os grupos" : "Monte seu palpite de gol"}</DialogTitle>
            <DialogDescription>
              {wizardMode === "all" ? "As escolhas de gols e assistências serão aplicadas em todos os seus grupos. " : ""}Gol {activeSelection?.goalIndex} da {activeTeam?.name} · etapa {wizardStep + 1} de {goalSelections.length}
            </DialogDescription>
          </DialogHeader>
          {activeSelection ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
              <div className="flex gap-1 overflow-hidden rounded-full bg-muted p-1">
                {goalSelections.map((selection, index) => <span key={`${selection.teamId}-${selection.goalIndex}`} className={`h-1.5 flex-1 rounded-full ${index === wizardStep ? "bg-primary" : selection.scorerPlayerId ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />)}
              </div>
              <div className="grid shrink-0 grid-cols-2 rounded-xl bg-muted p-1">
                <Button type="button" size="sm" variant={wizardTab === "scorer" ? "default" : "ghost"} onClick={() => { setWizardTab("scorer"); setPlayerPage(0); }}><GoalIcon />Quem vai fazer o gol</Button>
                <Button type="button" size="sm" variant={wizardTab === "assist" ? "default" : "ghost"} onClick={() => { setWizardTab("assist"); setPlayerPage(0); }} disabled={activeSelection.isOwnGoal}><HandshakeIcon />Quem vai dar assistência</Button>
              </div>
              <div className="flex shrink-0 items-center justify-between rounded-xl border bg-muted/30 px-3 py-2 text-sm font-semibold">
                <span className="flex items-center gap-2"><span className="text-lg">{countryFlag(activeSelection.isOwnGoal ? opposingTeam.shortName : activeTeam.shortName)}</span>{activeSelection.isOwnGoal ? `Gol contra da ${opposingTeam.name}` : activeTeam.name}</span>
                <span className="text-xs text-muted-foreground">{safePlayerPage + 1}/{totalPlayerPages}</span>
              </div>
              {wizardTab === "scorer" ? (
                <Button type="button" variant={activeSelection.isOwnGoal ? "default" : "outline"} className="shrink-0 justify-start" onClick={() => { updateActiveSelection({ isOwnGoal: !activeSelection.isOwnGoal, assistPlayerId: null, scorerPlayerId: null }); setPlayerPage(0); }}>
                    {activeSelection.isOwnGoal ? <CheckIcon /> : null} Gol contra — escolher jogador da {opposingTeam.name}
                </Button>
              ) : (
                <Button type="button" variant={activeSelection.assistPlayerId === null ? "default" : "outline"} className="shrink-0 justify-start" onClick={() => updateActiveSelection({ assistPlayerId: null })}><CheckIcon />Ninguém vai dar assistência</Button>
              )}
              <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 sm:grid-cols-3">
                {visiblePlayers.map((player) => {
                  const selected = wizardTab === "scorer" ? activeSelection.scorerPlayerId === player.id : activeSelection.assistPlayerId === player.id;
                  return <Button key={player.id} type="button" variant={selected ? "default" : "outline"} className="h-[88px] min-w-0 flex-col items-start justify-center gap-1 overflow-hidden px-3 text-left" onClick={() => {
                    if (wizardTab === "scorer") { updateActiveSelection({ scorerPlayerId: player.id }); setWizardTab(activeSelection.isOwnGoal ? "scorer" : "assist"); setPlayerPage(0); }
                    else updateActiveSelection({ assistPlayerId: player.id });
                  }}>
                    <span className="flex w-full items-center gap-1.5 text-xs text-muted-foreground"><Avatar size="sm" className="size-5"><AvatarImage src={player.photo_url ?? undefined} alt={player.name} /><AvatarFallback>{countryFlag((wizardTab === "scorer" && activeSelection.isOwnGoal ? opposingTeam : activeTeam).shortName)}</AvatarFallback></Avatar>{player.shirt_number ? `#${player.shirt_number}` : "Sem número"}</span>
                    <span className="w-full truncate text-sm font-bold">{player.name}</span>
                    <span className="text-xs opacity-75">{positionLabel[player.position] ?? "Jogador"}</span>
                  </Button>;
                })}
              </div>
              <div className="flex shrink-0 items-center justify-between">
                <Button type="button" size="sm" variant="outline" disabled={safePlayerPage === 0} onClick={() => setPlayerPage((page) => Math.max(0, page - 1))}><ChevronLeftIcon />Anteriores</Button>
                <Button type="button" size="sm" variant="outline" disabled={safePlayerPage >= totalPlayerPages - 1} onClick={() => setPlayerPage((page) => Math.min(totalPlayerPages - 1, page + 1))}>Próximos<ChevronRightIcon /></Button>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="secondary" disabled={wizardStep === 0 || saving} onClick={() => { setWizardStep((step) => step - 1); setWizardTab("scorer"); setPlayerPage(0); }}>Voltar</Button>
                {wizardStep < goalSelections.length - 1 ? <Button type="button" disabled={!activeSelection.scorerPlayerId || (!activeSelection.isOwnGoal && activeSelection.assistPlayerId === undefined)} onClick={() => { setWizardStep((step) => step + 1); setWizardTab("scorer"); setPlayerPage(0); }}>Próximo gol</Button> : <Button type="button" disabled={!activeSelection.scorerPlayerId || (!activeSelection.isOwnGoal && activeSelection.assistPlayerId === undefined) || saving || savingAll} onClick={confirmWizard}>{saving || savingAll ? "Salvando..." : wizardMode === "all" ? "Salvar em todos" : "Salvar palpite"}</Button>}
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
