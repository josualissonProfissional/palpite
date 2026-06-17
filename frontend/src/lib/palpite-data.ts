export type Team = {
  id?: string;
  name: string;
  shortName: string;
  code: string;
  group: string;
  logoUrl?: string;
};

export type Standing = {
  groupName?: string;
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: Array<"W" | "D" | "L">;
};

export type Match = {
  id: string;
  home: Team;
  away: Team;
  date: string;
  dateTime: string;
  venue: string;
  status: "live" | "scheduled" | "finished" | "locked";
  homeScore?: number;
  awayScore?: number;
  predictedHome?: number;
  predictedAway?: number;
  scoreStatus?: "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
  scoreReason?: string;
  points?: number;
  isFinalScore?: boolean;
  lockLabel: string;
};

export type RankingRow = {
  position: number;
  userId: string;
  name: string;
  avatarFallback: string;
  avatarUrl?: string;
  points: number;
  exactScores: number;
  partialHits: number;
  penalties: number;
  predicted: number;
  trend: "up" | "same" | "down";
};

export type Member = {
  userId: string;
  name: string;
  avatarFallback: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member";
  status: "active" | "pending" | "blocked" | "left";
  points?: number;
  joinedAt: string;
};

export type ScoringRules = {
  exactScorePoints: number;
  correctWinnerPoints: number;
  correctDrawPoints: number;
  correctGoalHomePoints: number;
  correctGoalAwayPoints: number;
  wrongPredictionPoints: number;
  inverseScorePolicy: "no_points" | "penalty" | "zero";
  inverseScorePenalty: number;
  allowNegativeScore: boolean;
  lockPredictionMinutesBefore: number;
  showPredictionsBeforeLock: boolean;
  showPredictionsAfterLock: boolean;
};

export type GroupSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  inviteCode: string | null;
  role: "owner" | "admin" | "member";
  status: "active" | "pending" | "blocked" | "left";
  memberCount?: number;
};

export function flagUrl(code: string, size: 40 | 80 | 160 = 80) {
  return `https://flagcdn.com/w${size}/${code}.png`;
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
