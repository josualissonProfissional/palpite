import { createClient } from "@/lib/supabase/server";
import {
  type BestPlayer,
  type BestPlayerFormation,
  type BestPlayerRules,
  type BestPlayerSelection,
  type BestPlayerWindow,
  initials,
  type GroupSummary,
  type Match,
  type Member,
  type RankingRow,
  type ScoringRules,
  type Standing,
  type Team,
} from "@/lib/palpite-data";

type BestPlayerDbWindow = {
  id: string;
  kind: "daily" | "round";
  vote_date: string | null;
  round_name: string | null;
  status: BestPlayerWindow["status"];
  opened_at: string | null;
  closes_at: string | null;
  duration_minutes: number | null;
  eligibility_source: BestPlayerWindow["eligibilitySource"] | null;
  allow_edit_snapshot: boolean;
  respect_position_snapshot: boolean;
  result_formation: BestPlayerFormation | null;
};

type BestPlayerDbRow = {
  id: string;
  name: string;
  position: BestPlayer["position"];
  shirt_number: number | null;
  team_id: string;
  team: { name: string; country: string | null; logo_url: string | null } | null;
};

function toBestPlayer(row: BestPlayerDbRow, participationStatus: BestPlayer["participationStatus"] = "unknown"): BestPlayer {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    shirtNumber: row.shirt_number ?? undefined,
    teamId: row.team_id,
    teamName: row.team?.name ?? "Seleção",
    teamCountry: row.team?.country ?? undefined,
    teamLogoUrl: row.team?.logo_url ?? undefined,
    participationStatus,
  };
}

function toBestPlayerWindow(row: BestPlayerDbWindow): BestPlayerWindow {
  return {
    id: row.id,
    kind: row.kind,
    voteDate: row.vote_date ?? undefined,
    roundName: row.round_name ?? undefined,
    status: row.status,
    openedAt: row.opened_at ?? undefined,
    closesAt: row.closes_at ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    eligibilitySource: row.eligibility_source ?? undefined,
    allowEdit: row.allow_edit_snapshot,
    respectPosition: row.respect_position_snapshot,
    resultFormation: row.result_formation ?? undefined,
  };
}

type TeamRow = {
  id?: string;
  name: string | null;
  country: string | null;
  logo_url: string | null;
};

type MatchRow = {
  id: string;
  group_name: string | null;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: TeamRow | null;
  away_team: TeamRow | null;
};

type PredictionRow = {
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
};

type PredictionScoreRow = {
  match_id: string;
  points: number;
  status: Match["scoreStatus"];
  score_reason: string | null;
  is_final: boolean;
};

type StandingRow = {
  group_name: string | null;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  team: TeamRow | null;
};

type GroupMemberRow = {
  role: GroupSummary["role"];
  status: GroupSummary["status"];
  joined_at: string | null;
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    invite_code: string | null;
    allow_member_invites: boolean;
  } | null;
};

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  invite_code: string | null;
  allow_member_invites: boolean;
};

type MemberRow = {
  user_id: string;
  role: Member["role"];
  status: Member["status"];
  joined_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
};

type RankingRpcRow = {
  rank_position: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  best_players_points: number;
  exact_scores: number;
  partial_hits: number;
  penalties: number;
  predicted_matches: number;
};

type ScoringRulesRow = {
  exact_score_points: number;
  correct_winner_points: number;
  correct_draw_points: number;
  correct_goal_home_points: number;
  correct_goal_away_points: number;
  wrong_prediction_points: number;
  inverse_score_policy: ScoringRules["inverseScorePolicy"];
  inverse_score_penalty: number;
  allow_negative_score: boolean;
  lock_prediction_minutes_before: number;
  show_predictions_before_lock: boolean;
  show_predictions_after_lock: boolean;
};

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

function groupLetter(groupName?: string | null) {
  return groupName?.replace("Group ", "") ?? "";
}

function groupLabel(groupName?: string | null) {
  return groupName?.replace("Group", "Grupo") ?? "Grupo";
}

function toTeam(row: TeamRow | null, groupName?: string | null): Team {
  const name = row?.name ?? "Selecao a definir";
  return {
    id: row?.id,
    name,
    shortName: row?.country ?? initials(name) ?? "TBD",
    code: "un",
    group: groupLetter(groupName),
    logoUrl: row?.logo_url ?? undefined,
  };
}

function toUiStatus(status: string): Match["status"] {
  if (status === "finished") return "finished";
  if (status === "live" || status === "halftime") return "live";
  return "scheduled";
}

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Recife",
  }).format(new Date(value));
}

function lockLabel(status: Match["status"], date: string) {
  if (status === "finished") return "Finalizado";
  if (status === "live") return "Ao vivo";
  return `Aberto ate ${formatMatchDate(date)}`;
}

function normalizeMatch(row: MatchRow): Match {
  const status = toUiStatus(row.status);
  return {
    id: row.id,
    home: toTeam(row.home_team, row.group_name),
    away: toTeam(row.away_team, row.group_name),
    date: formatMatchDate(row.match_date),
    dateTime: row.match_date,
    venue: groupLabel(row.group_name),
    status,
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
    lockLabel: lockLabel(status, row.match_date),
  };
}

function normalizeStanding(row: StandingRow): Standing {
  return {
    groupName: groupLabel(row.group_name),
    position: row.position,
    team: toTeam(row.team, row.group_name),
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    points: row.points,
    form: [],
  };
}

export async function getWorldCupData() {
  if (!hasSupabaseEnv()) {
    return { configured: false, matches: [], standings: [], teams: [] as Team[] };
  }

  try {
    const supabase = await createClient();
    const db = supabase.schema("palpite");

    const { data: competition, error: competitionError } = await db
      .from("competitions")
      .select("id")
      .eq("name", "FIFA World Cup")
      .eq("season", "2026")
      .maybeSingle();

    if (competitionError || !competition) {
      return { configured: true, matches: [], standings: [], teams: [] as Team[] };
    }

    const [matchesResponse, standingsResponse] = await Promise.all([
      db
        .from("matches")
        .select(
          "id, group_name, match_date, status, home_score, away_score, home_team:home_team_id(id,name,country,logo_url), away_team:away_team_id(id,name,country,logo_url)"
        )
        .eq("competition_id", competition.id)
        .order("match_date", { ascending: true }),
      db
        .from("standings")
        .select(
          "group_name, position, played, won, drawn, lost, goals_for, goals_against, points, team:team_id(id,name,country,logo_url)"
        )
        .eq("competition_id", competition.id)
        .order("group_name", { ascending: true })
        .order("position", { ascending: true }),
    ]);

    const matches = matchesResponse.error
      ? []
      : ((matchesResponse.data ?? []) as unknown as MatchRow[]).map(normalizeMatch);
    const standings = standingsResponse.error
      ? []
      : ((standingsResponse.data ?? []) as unknown as StandingRow[]).map(normalizeStanding);
    const teams = Array.from(
      new Map(
        standings.map((standing) => [standing.team.id ?? standing.team.name, standing.team])
      ).values()
    );

    return { configured: true, matches, standings, teams };
  } catch (error) {
    return {
      configured: true,
      matches: [],
      standings: [],
      teams: [] as Team[],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getGroupWorldCupData(groupId?: string) {
  const worldCup = await getWorldCupData();

  if (!hasSupabaseEnv() || !groupId || worldCup.matches.length === 0) {
    return worldCup;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return worldCup;

  const matchIds = worldCup.matches.map((match) => match.id);
  const db = supabase.schema("palpite");
  const [predictionsResponse, scoresResponse] = await Promise.all([
    db
      .from("predictions")
      .select("match_id, predicted_home_score, predicted_away_score")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .in("match_id", matchIds),
    db
      .from("prediction_scores")
      .select("match_id, points, status, score_reason, is_final")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .in("match_id", matchIds),
  ]);

  const predictions = new Map(
    ((predictionsResponse.data ?? []) as PredictionRow[]).map((row) => [row.match_id, row])
  );
  const scores = new Map(
    ((scoresResponse.data ?? []) as PredictionScoreRow[]).map((row) => [row.match_id, row])
  );

  return {
    ...worldCup,
    matches: worldCup.matches.map((match) => {
      const prediction = predictions.get(match.id);
      const score = scores.get(match.id);
      return {
        ...match,
        predictedHome: prediction?.predicted_home_score,
        predictedAway: prediction?.predicted_away_score,
        scoreStatus: score?.status,
        scoreReason: score?.score_reason ?? undefined,
        points: score?.points,
        isFinalScore: score?.is_final,
      };
    }),
  };
}

export async function getGroupsData() {
  if (!hasSupabaseEnv()) return { configured: false, groups: [] as GroupSummary[] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { configured: true, authenticated: false, groups: [] as GroupSummary[] };

  const { data, error } = await supabase
    .schema("palpite")
    .from("group_members")
    .select("role, status, joined_at, group:group_id(id,name,slug,description,invite_code,allow_member_invites)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) return { configured: true, authenticated: true, groups: [] as GroupSummary[], error: error.message };

  return {
    configured: true,
    authenticated: true,
    groups: ((data ?? []) as unknown as GroupMemberRow[])
      .filter((row) => row.group)
      .map((row) => ({
        id: row.group!.id,
        name: row.group!.name,
        slug: row.group!.slug,
        description: row.group!.description,
        inviteCode: row.group!.invite_code,
        allowMemberInvites: row.group!.allow_member_invites,
        role: row.role,
        status: row.status,
      })),
  };
}

export async function getGroupData(slug: string) {
  if (!hasSupabaseEnv()) return { configured: false, group: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { configured: true, authenticated: false, group: null };

  const db = supabase.schema("palpite");
  const { data: group, error } = await db
    .from("groups")
    .select("id,name,slug,description,invite_code,allow_member_invites")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !group) {
    return {
      configured: true,
      authenticated: true,
      group: null,
      error: error?.message,
    };
  }

  const { data: membership } = await db
    .from("group_members")
    .select("role, status")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const typedGroup = group as GroupRow;

  return {
    configured: true,
    authenticated: true,
    group: {
      id: typedGroup.id,
      name: typedGroup.name,
      slug: typedGroup.slug,
      description: typedGroup.description,
      inviteCode: typedGroup.invite_code,
      allowMemberInvites: typedGroup.allow_member_invites,
      role: (membership?.role ?? "member") as GroupSummary["role"],
      status: (membership?.status ?? "active") as GroupSummary["status"],
    },
  };
}

export async function getMembers(groupId?: string) {
  if (!hasSupabaseEnv() || !groupId) return [] as Member[];

  const db = (await createClient()).schema("palpite");
  const { data: memberRows, error } = await db
    .from("group_members")
    .select("user_id, role, status, joined_at")
    .eq("group_id", groupId);

  if (error || !memberRows?.length) return [];

  const ids = (memberRows as MemberRow[]).map((row) => row.user_id);
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, nickname, avatar_url")
    .in("id", ids);
  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));

  return (memberRows as MemberRow[]).map<Member>((member) => {
    const profile = profileById.get(member.user_id);
    const name = profile?.full_name ?? profile?.nickname ?? "Participante";
    return {
      userId: member.user_id,
      name,
      avatarFallback: initials(name) || "P",
      avatarUrl: profile?.avatar_url ?? undefined,
      role: member.role,
      status: member.status,
      joinedAt: member.joined_at
        ? formatMatchDate(member.joined_at)
        : "Sem data",
    };
  });
}

export async function getScoringRules(groupId?: string): Promise<ScoringRules | null> {
  if (!hasSupabaseEnv() || !groupId) return null;

  const { data, error } = await (await createClient())
    .schema("palpite")
    .from("scoring_rules")
    .select(
      "exact_score_points, correct_winner_points, correct_draw_points, correct_goal_home_points, correct_goal_away_points, wrong_prediction_points, inverse_score_policy, inverse_score_penalty, allow_negative_score, lock_prediction_minutes_before, show_predictions_before_lock, show_predictions_after_lock"
    )
    .eq("group_id", groupId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ScoringRulesRow;
  return {
    exactScorePoints: row.exact_score_points,
    correctWinnerPoints: row.correct_winner_points,
    correctDrawPoints: row.correct_draw_points,
    correctGoalHomePoints: row.correct_goal_home_points,
    correctGoalAwayPoints: row.correct_goal_away_points,
    wrongPredictionPoints: row.wrong_prediction_points,
    inverseScorePolicy: row.inverse_score_policy,
    inverseScorePenalty: row.inverse_score_penalty,
    allowNegativeScore: row.allow_negative_score,
    lockPredictionMinutesBefore: row.lock_prediction_minutes_before,
    showPredictionsBeforeLock: row.show_predictions_before_lock,
    showPredictionsAfterLock: row.show_predictions_after_lock,
  };
}

export type BestPlayerLoadedVote = {
  formation: BestPlayerFormation;
  selections: BestPlayerSelection[];
};

export type BestPlayerResultRow = BestPlayerSelection & {
  player: BestPlayer;
  roundVotes: number;
  dailyVotesTiebreak: number;
};

export type BestPlayerGroupTeam = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  formation: BestPlayerFormation;
  selections: BestPlayerSelection[];
  hits: number;
  points: number;
};

export type BestPlayerPageData = {
  rules: BestPlayerRules;
  dailyWindow: BestPlayerWindow | null;
  roundWindow: BestPlayerWindow | null;
  dailyPlayers: BestPlayer[];
  roundPlayers: BestPlayer[];
  dailyVote: BestPlayerLoadedVote | null;
  roundVote: BestPlayerLoadedVote | null;
  result: BestPlayerResultRow[];
  score: { hits: number; points: number } | null;
  roundBallotCount: number;
  groupTeams: BestPlayerGroupTeam[];
};

const defaultBestPlayerRules: BestPlayerRules = {
  dailyVotingEnabled: true,
  roundTeamVotingEnabled: false,
  pointsPerAverageHit: 1,
  allowDailyVoteEditBeforeClose: true,
  allowRoundVoteEditBeforeClose: true,
  allowDailyVoteEditAfterClose: false,
  allowRoundTeamEditAfterClose: false,
  respectPlayerPosition: true,
};

export async function getBestPlayerPageData(groupId?: string): Promise<BestPlayerPageData> {
  const empty: BestPlayerPageData = {
    rules: defaultBestPlayerRules,
    dailyWindow: null,
    roundWindow: null,
    dailyPlayers: [],
    roundPlayers: [],
    dailyVote: null,
    roundVote: null,
    result: [],
    score: null,
    roundBallotCount: 0,
    groupTeams: [],
  };
  if (!hasSupabaseEnv() || !groupId) return empty;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return empty;
  const db = supabase.schema("palpite");
  const [rulesResponse, windowsResponse] = await Promise.all([
    db.from("best_player_rules").select("*").eq("group_id", groupId).maybeSingle(),
    db.from("best_player_voting_windows")
      .select("id,kind,vote_date,round_name,status,opened_at,closes_at,duration_minutes,eligibility_source,allow_edit_snapshot,respect_position_snapshot,result_formation")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
  ]);

  const rulesRow = rulesResponse.data as Record<string, unknown> | null;
  const rules: BestPlayerRules = rulesRow ? {
    dailyVotingEnabled: Boolean(rulesRow.daily_voting_enabled),
    roundTeamVotingEnabled: Boolean(rulesRow.round_team_voting_enabled),
    pointsPerAverageHit: Number(rulesRow.points_per_average_hit ?? 1),
    allowDailyVoteEditBeforeClose: Boolean(rulesRow.allow_daily_vote_edit_before_close),
    allowRoundVoteEditBeforeClose: Boolean(rulesRow.allow_round_vote_edit_before_close),
    allowDailyVoteEditAfterClose: false,
    allowRoundTeamEditAfterClose: false,
    respectPlayerPosition: Boolean(rulesRow.respect_player_position),
  } : defaultBestPlayerRules;

  const windows = (windowsResponse.data ?? []) as unknown as BestPlayerDbWindow[];
  const statusWeight: Record<BestPlayerWindow["status"], number> = {
    open: 0, scheduled: 1, closed: 2, finalized: 3, cancelled: 4,
  };
  const chooseWindow = (kind: "daily" | "round") => windows
    .filter((window) => window.kind === kind)
    .sort((a, b) => statusWeight[a.status] - statusWeight[b.status])[0] ?? null;
  const dailyRow = chooseWindow("daily");
  const roundRow = chooseWindow("round");

  async function loadVote(windowId?: string | null): Promise<BestPlayerLoadedVote | null> {
    if (!windowId) return null;
    const { data: ballot } = await db.from("best_player_ballots")
      .select("id,formation").eq("window_id", windowId).eq("user_id", authData.user!.id).maybeSingle();
    if (!ballot) return null;
    const { data: selections } = await db.from("best_player_ballot_players")
      .select("player_id,slot_index,selected_role").eq("ballot_id", ballot.id).order("slot_index");
    return {
      formation: ballot.formation as BestPlayerFormation,
      selections: (selections ?? []).map((selection) => ({
        playerId: selection.player_id,
        slotIndex: selection.slot_index,
        selectedRole: selection.selected_role as BestPlayerSelection["selectedRole"],
      })),
    };
  }

  async function loadPlayers(ids: string[], matchIds: string[] = []): Promise<BestPlayer[]> {
    if (ids.length === 0) return [];
    const uniqueIds = Array.from(new Set(ids));
    const { data } = await db.from("players")
      .select("id,name,position,shirt_number,team_id,team:team_id(name,country,logo_url)")
      .in("id", uniqueIds).order("name");
    const statusByPlayerId = new Map<string, BestPlayer["participationStatus"]>();
    if (matchIds.length > 0) {
      const { data: appearances } = await db.from("match_player_appearances")
        .select("player_id,started,bench,entered")
        .in("player_id", uniqueIds)
        .in("match_id", Array.from(new Set(matchIds)));
      for (const appearance of appearances ?? []) {
        const current = statusByPlayerId.get(appearance.player_id);
        if (appearance.started) statusByPlayerId.set(appearance.player_id, "starter");
        else if (current !== "starter" && (appearance.bench || appearance.entered)) statusByPlayerId.set(appearance.player_id, "bench");
      }
    }
    return ((data ?? []) as unknown as BestPlayerDbRow[]).map((row) =>
      toBestPlayer(row, statusByPlayerId.get(row.id) ?? "unknown")
    );
  }

  let dailyPlayers: BestPlayer[] = [];
  if (dailyRow) {
    const [{ data: windowPlayers }, { data: windowMatches }] = await Promise.all([
      db.from("best_player_window_players").select("player_id").eq("window_id", dailyRow.id),
      db.from("best_player_window_matches").select("match_id").eq("window_id", dailyRow.id),
    ]);
    dailyPlayers = await loadPlayers(
      (windowPlayers ?? []).map((row) => row.player_id),
      (windowMatches ?? []).map((row) => row.match_id),
    );
  }

  let roundPlayers: BestPlayer[] = [];
  let roundMatchIds: string[] = [];
  if (roundRow) {
    const { data: roundMatches } = await db.from("best_player_window_matches")
      .select("match_id").eq("window_id", roundRow.id);
    roundMatchIds = (roundMatches ?? []).map((row) => row.match_id);
    if (roundMatchIds.length > 0) {
      const { data: linkedWindows } = await db.from("best_player_window_matches")
        .select("window_id").in("match_id", roundMatchIds);
      const linkedIds = Array.from(new Set((linkedWindows ?? []).map((row) => row.window_id)));
      if (linkedIds.length > 0) {
        const { data: dailyWindows } = await db.from("best_player_voting_windows")
          .select("id").eq("group_id", groupId).eq("kind", "daily").in("id", linkedIds);
        const dailyIds = (dailyWindows ?? []).map((row) => row.id);
        if (dailyIds.length > 0) {
          const { data: ballots } = await db.from("best_player_ballots")
            .select("id").eq("user_id", authData.user.id).in("window_id", dailyIds);
          const ballotIds = (ballots ?? []).map((row) => row.id);
          if (ballotIds.length > 0) {
            const { data: selections } = await db.from("best_player_ballot_players")
              .select("player_id").in("ballot_id", ballotIds);
            roundPlayers = await loadPlayers((selections ?? []).map((row) => row.player_id), roundMatchIds);
          }
        }
      }
    }
  }

  let result: BestPlayerResultRow[] = [];
  let score: BestPlayerPageData["score"] = null;
  let roundBallotCount = 0;
  let groupTeams: BestPlayerGroupTeam[] = [];
  if (roundRow?.status === "finalized") {
    const [{ data: resultRows }, { data: scoreRow }, { data: ballotRows }, { data: scoreRows }] = await Promise.all([
      db.from("best_player_results")
        .select("player_id,slot_index,selected_role,round_votes,daily_votes_tiebreak")
        .eq("window_id", roundRow.id).order("slot_index"),
      db.from("best_player_scores")
        .select("hits,points").eq("window_id", roundRow.id).eq("user_id", authData.user.id).maybeSingle(),
      db.from("best_player_ballots")
        .select("id,user_id,formation").eq("window_id", roundRow.id).order("submitted_at"),
      db.from("best_player_scores")
        .select("user_id,hits,points").eq("window_id", roundRow.id),
    ]);
    // Há uma pontuação por cédula finalizada. Usar essa contagem evita que uma
    // política de leitura mais restritiva faça 3 votos parecerem 300%.
    roundBallotCount = scoreRows?.length || ballotRows?.length || 0;
    const ballotIds = (ballotRows ?? []).map((ballot) => ballot.id);
    const userIds = (ballotRows ?? []).map((ballot) => ballot.user_id);
    const [{ data: allSelections }, { data: profiles }] = await Promise.all([
      ballotIds.length > 0
        ? db.from("best_player_ballot_players")
          .select("ballot_id,player_id,slot_index,selected_role").in("ballot_id", ballotIds).order("slot_index")
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? db.from("profiles").select("id,full_name,nickname,avatar_url").in("id", userIds)
        : Promise.resolve({ data: [] }),
    ]);
    const sharedPlayerIds = (allSelections ?? []).map((selection) => selection.player_id);
    const resultPlayers = await loadPlayers(
      [...(resultRows ?? []).map((row) => row.player_id), ...sharedPlayerIds],
      roundMatchIds,
    );
    const byId = new Map(resultPlayers.map((player) => [player.id, player]));
    roundPlayers = Array.from(new Map([...roundPlayers, ...resultPlayers].map((player) => [player.id, player])).values());
    result = (resultRows ?? []).flatMap((row) => {
      const player = byId.get(row.player_id);
      return player ? [{
        playerId: row.player_id,
        slotIndex: row.slot_index,
        selectedRole: row.selected_role as BestPlayerSelection["selectedRole"],
        player,
        roundVotes: row.round_votes,
        dailyVotesTiebreak: row.daily_votes_tiebreak,
      }] : [];
    });
    score = scoreRow ? { hits: scoreRow.hits, points: scoreRow.points } : null;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const scoreByUserId = new Map((scoreRows ?? []).map((item) => [item.user_id, item]));
    const selectionsByBallotId = new Map<string, BestPlayerSelection[]>();
    for (const selection of allSelections ?? []) {
      const current = selectionsByBallotId.get(selection.ballot_id) ?? [];
      current.push({
        playerId: selection.player_id,
        slotIndex: selection.slot_index,
        selectedRole: selection.selected_role as BestPlayerSelection["selectedRole"],
      });
      selectionsByBallotId.set(selection.ballot_id, current);
    }
    groupTeams = (ballotRows ?? []).map((ballot) => {
      const profile = profileById.get(ballot.user_id);
      const userScore = scoreByUserId.get(ballot.user_id);
      return {
        userId: ballot.user_id,
        displayName: profile?.full_name || profile?.nickname || "Participante",
        avatarUrl: profile?.avatar_url ?? undefined,
        formation: ballot.formation as BestPlayerFormation,
        selections: selectionsByBallotId.get(ballot.id) ?? [],
        hits: userScore?.hits ?? 0,
        points: userScore?.points ?? 0,
      };
    }).sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName, "pt-BR"));
  }

  const [dailyVote, roundVote] = await Promise.all([loadVote(dailyRow?.id), loadVote(roundRow?.id)]);
  return {
    rules,
    dailyWindow: dailyRow ? toBestPlayerWindow(dailyRow) : null,
    roundWindow: roundRow ? toBestPlayerWindow(roundRow) : null,
    dailyPlayers,
    roundPlayers,
    dailyVote,
    roundVote,
    result,
    score,
    roundBallotCount,
    groupTeams,
  };
}

export async function getRanking(groupId?: string): Promise<RankingRow[]> {
  if (!hasSupabaseEnv() || !groupId) return [];

  const { data, error } = await (await createClient()).schema("palpite").rpc(
    "get_group_ranking",
    {
      p_group_id: groupId,
      p_round_name: null,
      p_match_date: null,
      p_stage: null,
      p_from: null,
      p_to: null,
    }
  );

  if (error || !data) return [];

  return (data as RankingRpcRow[]).map((row) => ({
    position: row.rank_position,
    userId: row.user_id,
    name: row.display_name,
    avatarFallback: initials(row.display_name) || "P",
    avatarUrl: row.avatar_url ?? undefined,
    points: row.total_points,
    bestPlayersPoints: row.best_players_points ?? 0,
    exactScores: row.exact_scores,
    partialHits: row.partial_hits,
    penalties: row.penalties,
    predicted: row.predicted_matches,
    trend: "same",
  }));
}

export async function getProfile() {
  if (!hasSupabaseEnv()) return { configured: false, authenticated: false, profile: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { configured: true, authenticated: false, profile: null };

  const { data } = await supabase
    .schema("palpite")
    .from("profiles")
    .select("id, full_name, nickname, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    configured: true,
    authenticated: true,
    profile: data as ProfileRow | null,
  };
}
