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
  status: "live" | "scheduled" | "finished" | "locked" | "suspended";
  homeScore?: number;
  awayScore?: number;
  predictedHome?: number;
  predictedAway?: number;
  scoreStatus?: "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";
  scoreReason?: string;
  points?: number;
  isFinalScore?: boolean;
  scorePoints?: number;
  goalAssistPoints?: number;
  goalScorerPoints?: number;
  goalAssistAssistPoints?: number;
  lockLabel: string;
  goalSelections?: GoalPredictionSelection[];
};

export type GoalPredictionSelection = {
  teamId: string;
  goalIndex: number;
  isOwnGoal: boolean;
  scorerName: string;
  scorerPhotoUrl?: string;
  scorerPosition: BestPlayerPosition;
  assistName?: string;
  assistPhotoUrl?: string;
  scorerHit?: boolean;
  assistHit?: boolean;
};

export type RankingRow = {
  position: number;
  userId: string;
  name: string;
  avatarFallback: string;
  avatarUrl?: string;
  points: number;
  bestPlayersPoints: number;
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
  goalScorerPoints: number;
  goalAssistPoints: number;
  goalAssistScoringMode: "separate" | "pair_only";
};

export type BestPlayerPosition = "gk" | "df" | "mf" | "fw";
export type BestPlayerFormation = "4-3-3" | "4-4-2" | "3-5-2" | "free-11";

export type BestPlayerRules = {
  dailyVotingEnabled: boolean;
  roundTeamVotingEnabled: boolean;
  pointsPerAverageHit: number;
  allowDailyVoteEditBeforeClose: boolean;
  allowRoundVoteEditBeforeClose: boolean;
  allowDailyVoteEditAfterClose: false;
  allowRoundTeamEditAfterClose: false;
  respectPlayerPosition: boolean;
};

export type BestPlayer = {
  id: string;
  name: string;
  position: BestPlayerPosition;
  shirtNumber?: number;
  teamId: string;
  teamName: string;
  teamCountry?: string;
  teamLogoUrl?: string;
  photoUrl?: string;
  participationStatus: "starter" | "bench" | "unknown";
};

export type BestPlayerSelection = {
  playerId: string;
  slotIndex: number;
  selectedRole: BestPlayerPosition;
};

export type BestPlayerWindow = {
  id: string;
  kind: "daily" | "round";
  voteDate?: string;
  roundName?: string;
  status: "scheduled" | "open" | "closed" | "finalized" | "cancelled";
  openedAt?: string;
  closesAt?: string;
  durationMinutes?: number;
  eligibilitySource?: "appearances" | "squad";
  allowEdit: boolean;
  respectPosition: boolean;
  resultFormation?: BestPlayerFormation;
  pendingMatch?: {
    homeName: string;
    awayName: string;
    matchDate: string;
  };
};

export type PendingAction = {
  id: string;
  kind: "prediction" | "daily_team" | "round_team";
  title: string;
  description: string;
  deadline: string;
  href: string;
  buttonLabel: string;
};

export type GroupSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  inviteCode: string | null;
  allowMemberInvites: boolean;
  role: "owner" | "admin" | "member";
  status: "active" | "pending" | "blocked" | "left";
  memberCount?: number;
};

export function flagUrl(code: string, size: 40 | 80 | 160 = 80) {
  return `https://flagcdn.com/w${size}/${code}.png`;
}

const countryToCode: Record<string, string> = {
  ARG: "AR", ARGENTINA: "AR", AUS: "AU", AUSTRALIA: "AU", AUT: "AT", AUSTRIA: "AT",
  BEL: "BE", BELGIUM: "BE", BRA: "BR", BRAZIL: "BR", CAN: "CA", CANADA: "CA",
  CHI: "CL", CHILE: "CL", COL: "CO", COLOMBIA: "CO", CRC: "CR", "COSTA RICA": "CR",
  CRO: "HR", CROATIA: "HR", CUR: "CW", "CURAÇAO": "CW", CURACAO: "CW", DEN: "DK", DENMARK: "DK",
  ECU: "EC", ECUADOR: "EC", EGY: "EG", EGYPT: "EG", ENG: "GB", ENGLAND: "GB", ESP: "ES", SPAIN: "ES",
  FRA: "FR", FRANCE: "FR", GER: "DE", DEU: "DE", GERMANY: "DE", GHA: "GH", GHANA: "GH",
  HAI: "HT", HAITI: "HT", IRN: "IR", IRAN: "IR", ITA: "IT", ITALY: "IT", JAM: "JM", JAMAICA: "JM",
  JPN: "JP", JAPAN: "JP", KOR: "KR", "SOUTH KOREA": "KR", MAR: "MA", MOROCCO: "MA", MEX: "MX", MEXICO: "MX",
  NED: "NL", NETHERLANDS: "NL", NZL: "NZ", "NEW ZEALAND": "NZ", NOR: "NO", NORWAY: "NO", PAN: "PA", PANAMA: "PA",
  PAR: "PY", PARAGUAY: "PY", POR: "PT", PORTUGAL: "PT", QAT: "QA", QATAR: "QA", KSA: "SA", "SAUDI ARABIA": "SA",
  SCO: "GB", SCOTLAND: "GB", SEN: "SN", SENEGAL: "SN", SWE: "SE", SWEDEN: "SE", SUI: "CH", SWITZERLAND: "CH",
  TUN: "TN", TUNISIA: "TN", TUR: "TR", TURKEY: "TR", URU: "UY", URUGUAY: "UY", USA: "US", "UNITED STATES": "US",
};

export function countryFlag(country?: string) {
  const normalized = String(country ?? "").trim().toUpperCase();
  const code = normalized.length === 2 ? normalized : countryToCode[normalized];
  return code && /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((char) => 0x1F1E6 + char.charCodeAt(0) - 65))
    : "🏳️";
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
