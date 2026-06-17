import { createClient } from "@/lib/supabase/server";
import {
  initials,
  type GroupSummary,
  type Match,
  type Member,
  type RankingRow,
  type ScoringRules,
  type Standing,
  type Team,
} from "@/lib/palpite-data";

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
  } | null;
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
    .select("role, status, joined_at, group:group_id(id,name,slug,description,invite_code)")
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
    .select("id,name,slug,description,invite_code")
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

  return {
    configured: true,
    authenticated: true,
    group: {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      inviteCode: group.invite_code,
      role: "member" as const,
      status: "active" as const,
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
    const name = profile?.nickname ?? profile?.full_name ?? "Participante";
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
