import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type AdminClient = any;

type DbMatch = {
  id: string;
  api_fixture_id: number | null;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  highlightly_import_attempts?: number;
  home_team: { name: string | null; country: string | null } | null;
  away_team: { name: string | null; country: string | null } | null;
};

type FallbackResult = {
  configured: boolean;
  attempted: boolean;
  skipped_reason?: string;
  fetched?: number;
  live?: number;
  updated?: number;
  imported?: number;
  events?: number;
  matches?: number;
  error?: string;
};

type PlayerSyncResult = {
  attempted: number;
  imported: number;
  appearances: number;
  squad_fallbacks: number;
  errors: string[];
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const apiSportsMinIntervalMs = 5 * 60_000;
const apiSportsLineupMinIntervalMs = 60_000;
const worldCup26MinIntervalMs = 15_000;
const maxPlayerImportsPerRun = 2;
const maxApiSportsLineupImportsPerRun = 2;
const highlightlyHost = "football-highlights-api.p.rapidapi.com";
const highlightlyWorldCupLeagueId = "1635";
const highlightlyRetryMinutes = 15;
const maxHighlightlyMatchesPerRun = 2;
const highlightlyRequestIntervalMs = 1_250;

function apiSportsIsStandby() {
  return Deno.env.get("API_SPORTS_STANDBY") === "true";
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requireInternalSecret(req: Request) {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected) return "INTERNAL_FUNCTION_SECRET is not configured";
  if (req.headers.get("x-internal-secret") !== expected) return "Invalid internal secret";
  return null;
}

function mapFootballDataStatus(status?: string): string {
  switch (status) {
    case "IN_PLAY":
      return "live";
    case "PAUSED":
      return "halftime";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "POSTPONED":
      return "postponed";
    case "SUSPENDED":
    case "CANCELLED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

function mapApiSportsStatus(shortStatus?: string): string {
  switch (shortStatus) {
    case "1H":
    case "2H":
    case "ET":
    case "P":
      return "live";
    case "HT":
      return "halftime";
    case "FT":
    case "AET":
    case "PEN":
      return "finished";
    case "PST":
      return "postponed";
    case "CANC":
    case "ABD":
      return "cancelled";
    default:
      return "scheduled";
  }
}

function normalizeTeam(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamMatches(a?: string | null, b?: string | null) {
  const left = normalizeTeam(a);
  const right = normalizeTeam(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2 && token !== "and"));
  return right
    .split(" ")
    .filter((token) => token.length > 2 && token !== "and")
    .some((token) => leftTokens.has(token));
}

function closeKickoff(a: string, b?: string) {
  if (!b) return false;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 10 * 60_000;
}

function isActiveStatus(status?: string | null) {
  return status === "live" || status === "halftime";
}

function shouldPreserveCurrentLiveScore(
  current: Pick<DbMatch, "status" | "home_score" | "away_score"> | null | undefined,
  incomingStatus: string,
  incomingHomeScore: number | null,
  incomingAwayScore: number | null,
) {
  if (!current) return false;
  if (!isActiveStatus(current.status) || !isActiveStatus(incomingStatus)) return false;
  if (current.home_score === null || current.away_score === null) return false;
  if (incomingHomeScore === null || incomingAwayScore === null) return false;

  const currentTotal = current.home_score + current.away_score;
  const incomingTotal = incomingHomeScore + incomingAwayScore;
  return (
    incomingTotal < currentTotal ||
    incomingHomeScore < current.home_score ||
    incomingAwayScore < current.away_score
  );
}

function mapPlayerPosition(value?: string | null): "gk" | "df" | "mf" | "fw" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("goal")) return "gk";
  if (normalized.includes("back") || normalized.includes("defen")) return "df";
  if (normalized.includes("midfield")) return "mf";
  return "fw";
}

async function upsertPlayer(admin: AdminClient, player: any, teamId: string) {
  if (!player?.id || !player?.name) return null;
  const { data, error } = await admin
    .from("players")
    .upsert({
      api_player_id: Number(player.id),
      team_id: teamId,
      name: String(player.name),
      position: mapPlayerPosition(player.position),
      shirt_number: Number.isInteger(player.shirtNumber) ? player.shirtNumber : null,
      active: true,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "api_player_id" })
    .select("id, position")
    .single();
  if (error) throw error;
  return data as { id: string; position: "gk" | "df" | "mf" | "fw" };
}

async function importTeamSquad(
  admin: AdminClient,
  apiToken: string,
  dbTeamId: string,
  apiTeamId: number | null,
) {
  if (!apiTeamId) return 0;
  const { count } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("team_id", dbTeamId);
  if ((count ?? 0) >= 11) return count ?? 0;

  const response = await fetch(`https://api.football-data.org/v4/teams/${apiTeamId}`, {
    headers: { "X-Auth-Token": apiToken },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`football-data.org team ${apiTeamId} returned ${response.status}`);
  const payload = await response.json();
  let imported = 0;
  for (const player of payload.squad ?? []) {
    if (await upsertPlayer(admin, player, dbTeamId)) imported += 1;
  }
  return imported;
}

async function upsertAppearanceRows(admin: AdminClient, rows: Array<Record<string, unknown>>) {
  const { error } = await admin
    .from("match_player_appearances")
    .upsert(rows, { onConflict: "match_id,player_id" });
  if (!error) return { count: rows.length, includesBench: true };
  if (!String(error.message ?? error).toLowerCase().includes("bench")) throw error;

  // Permite publicar a função antes da migration incremental. Nesse intervalo,
  // titulares e atletas que entraram continuam sendo sincronizados.
  const legacyRows = rows
    .filter((row) => row.started || row.entered)
    .map(({ bench: _bench, ...row }) => row);
  if (legacyRows.length === 0) return { count: 0, includesBench: false };
  const { error: legacyError } = await admin
    .from("match_player_appearances")
    .upsert(legacyRows, { onConflict: "match_id,player_id" });
  if (legacyError) throw legacyError;
  return { count: legacyRows.length, includesBench: false };
}

async function importUnfoldedMatchRoster(
  admin: AdminClient,
  apiMatch: any,
  match: { id: string; home_team_id: string; away_team_id: string },
) {
  const sides = [
    { data: apiMatch.homeTeam, teamId: match.home_team_id },
    { data: apiMatch.awayTeam, teamId: match.away_team_id },
  ];
  const appearanceRows: Array<Record<string, unknown>> = [];

  for (const side of sides) {
    const starters = Array.isArray(side.data?.lineup) ? side.data.lineup : [];
    const bench = Array.isArray(side.data?.bench) ? side.data.bench : [];
    const enteredIds = new Set<number>(
      (apiMatch.substitutions ?? [])
        .filter((substitution: any) => Number(substitution.team?.id) === Number(side.data?.id))
        .map((substitution: any) => Number(substitution.playerIn?.id))
        .filter(Number.isFinite),
    );

    for (const player of [...starters, ...bench]) {
      const saved = await upsertPlayer(admin, player, side.teamId);
      if (!saved) continue;
      const started = starters.some((starter: any) => Number(starter.id) === Number(player.id));
      appearanceRows.push({
        match_id: match.id,
        player_id: saved.id,
        team_id: side.teamId,
        position: saved.position,
        started,
        bench: !started,
        entered: enteredIds.has(Number(player.id)),
      });
    }
  }

  if (appearanceRows.length < 22) return 0;
  const saved = await upsertAppearanceRows(admin, appearanceRows);
  const { error: matchError } = await admin.from("matches").update({
    best_players_imported_at: new Date().toISOString(),
    best_players_data_source: saved.includesBench ? "appearances" : "squad",
  }).eq("id", match.id);
  if (matchError) throw matchError;
  return saved.count;
}

async function syncFinishedMatchPlayers(
  admin: AdminClient,
  apiToken: string,
  season: string,
): Promise<PlayerSyncResult> {
  const result: PlayerSyncResult = { attempted: 0, imported: 0, appearances: 0, squad_fallbacks: 0, errors: [] };
  const { data: pending, error } = await admin
    .from("matches")
    .select("id, api_fixture_id, home_team_id, away_team_id, best_players_import_attempts, home_team:home_team_id(api_team_id), away_team:away_team_id(api_team_id)")
    .eq("status", "finished")
    .gte("match_date", `${season}-01-01T00:00:00Z`)
    .is("best_players_imported_at", null)
    .not("api_fixture_id", "is", null)
    .order("match_date", { ascending: false })
    .limit(maxPlayerImportsPerRun);
  if (error) throw error;

  for (const match of pending ?? []) {
    result.attempted += 1;
    try {
      await admin.from("matches").update({
        best_players_import_attempts: (match.best_players_import_attempts ?? 0) + 1,
      }).eq("id", match.id);

      const baseSides = [
        { teamId: match.home_team_id, apiTeamId: match.home_team?.api_team_id ?? null },
        { teamId: match.away_team_id, apiTeamId: match.away_team?.api_team_id ?? null },
      ];
      const response = await fetch(`https://api.football-data.org/v4/matches/${match.api_fixture_id}`, {
        headers: { "X-Auth-Token": apiToken },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        for (const side of baseSides) await importTeamSquad(admin, apiToken, side.teamId, side.apiTeamId);
        const { error: fallbackError } = await admin.from("matches").update({
          best_players_imported_at: new Date().toISOString(),
          best_players_data_source: "squad",
        }).eq("id", match.id);
        if (fallbackError) throw fallbackError;
        result.squad_fallbacks += 1;
        continue;
      }
      const detail = await response.json();
      const sides = [
        { data: detail.homeTeam, ...baseSides[0] },
        { data: detail.awayTeam, ...baseSides[1] },
      ];
      const appearanceRows: Array<Record<string, unknown>> = [];

      for (const side of sides) {
        const starters = side.data?.lineup ?? [];
        const bench = side.data?.bench ?? [];
        const enteredIds = new Set<number>(
          (detail.substitutions ?? [])
            .filter((substitution: any) => Number(substitution.team?.id) === Number(side.data?.id))
            .map((substitution: any) => Number(substitution.playerIn?.id))
            .filter(Number.isFinite),
        );
        const roster = [...starters, ...bench];
        for (const player of roster) {
          const saved = await upsertPlayer(admin, player, side.teamId);
          if (!saved) continue;
          result.imported += 1;
          const started = starters.some((starter: any) => Number(starter.id) === Number(player.id));
          const entered = enteredIds.has(Number(player.id));
          appearanceRows.push({
            match_id: match.id,
            player_id: saved.id,
            team_id: side.teamId,
            position: saved.position,
            started,
            bench: !started,
            entered,
          });
        }
      }

      let source: "appearances" | "squad" = "appearances";
      if (appearanceRows.length >= 22) {
        const saved = await upsertAppearanceRows(admin, appearanceRows);
        result.appearances += saved.count;
        if (!saved.includesBench) source = "squad";
      } else {
        source = "squad";
      }
      if (source === "squad") {
        for (const side of sides) {
          await importTeamSquad(admin, apiToken, side.teamId, side.apiTeamId);
        }
        result.squad_fallbacks += 1;
      }

      const { error: finishError } = await admin.from("matches").update({
        best_players_imported_at: new Date().toISOString(),
        best_players_data_source: source,
      }).eq("id", match.id);
      if (finishError) throw finishError;
    } catch (syncError) {
      result.errors.push(syncError instanceof Error ? syncError.message : String(syncError));
    }
  }
  return result;
}

function findApiSportsFixture(fixtures: any[], match: DbMatch) {
  return fixtures.find((fixture) => {
    if (!closeKickoff(match.match_date, fixture.fixture?.date)) return false;

    const homeName = match.home_team?.name;
    const awayName = match.away_team?.name;
    const apiHomeName = fixture.teams?.home?.name;
    const apiAwayName = fixture.teams?.away?.name;

    return teamMatches(homeName, apiHomeName) && teamMatches(awayName, apiAwayName);
  });
}

async function shouldTryApiSports(admin: AdminClient) {
  return shouldTryProvider(admin, "api-sports-fallback", apiSportsMinIntervalMs);
}

async function shouldTryApiSportsLineups(admin: AdminClient) {
  return shouldTryProvider(admin, "api-sports-lineups", apiSportsLineupMinIntervalMs);
}

async function shouldTryWorldCup26(admin: AdminClient) {
  return shouldTryProvider(admin, "worldcup26-fallback", worldCup26MinIntervalMs);
}

async function shouldTryProvider(admin: AdminClient, provider: string, minIntervalMs: number) {
  const since = new Date(Date.now() - minIntervalMs).toISOString();
  const { data, error } = await admin
    .from("sync_runs")
    .select("id")
    .eq("kind", "live")
    .eq("provider", provider)
    .gte("started_at", since)
    .limit(1);

  if (error) throw error;
  return (data ?? []).length === 0;
}

async function getFallbackCandidates(admin: AdminClient): Promise<DbMatch[]> {
  const windowStart = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  const windowEnd = new Date().toISOString();
  const { data, error } = await admin
    .from("matches")
    .select("id, api_fixture_id, home_team_id, away_team_id, match_date, status, home_score, away_score, home_team:home_team_id(name,country), away_team:away_team_id(name,country)")
    .lte("match_date", windowEnd)
    .gt("match_date", windowStart);

  if (error) throw error;
  return (data ?? []) as unknown as DbMatch[];
}

async function getFinishedLineupCandidates(admin: AdminClient, season: string): Promise<DbMatch[]> {
  const { data: matches, error } = await admin
    .from("matches")
    .select("id, api_fixture_id, home_team_id, away_team_id, match_date, status, home_score, away_score, home_team:home_team_id(name,country), away_team:away_team_id(name,country)")
    .eq("status", "finished")
    .gte("match_date", `${season}-01-01T00:00:00Z`)
    .order("match_date", { ascending: false })
    .limit(40);
  if (error) throw error;

  const candidates = (matches ?? []) as unknown as DbMatch[];
  if (candidates.length === 0) return [];
  const { data: appearances, error: appearancesError } = await admin
    .from("match_player_appearances")
    .select("match_id")
    .eq("started", true)
    .in("match_id", candidates.map((match) => match.id));
  if (appearancesError) throw appearancesError;

  const starterCounts = new Map<string, number>();
  for (const appearance of appearances ?? []) {
    starterCounts.set(appearance.match_id, (starterCounts.get(appearance.match_id) ?? 0) + 1);
  }
  return candidates
    .filter((match) => (starterCounts.get(match.id) ?? 0) < 11)
    .slice(0, maxApiSportsLineupImportsPerRun);
}

type ExistingTeamPlayer = {
  id: string;
  name: string;
  position: "gk" | "df" | "mf" | "fw";
  highlightly_player_id: number | null;
};

async function getExistingTeamPlayers(admin: AdminClient, teamId: string): Promise<ExistingTeamPlayer[]> {
  const { data, error } = await admin
    .from("players")
    .select("id,name,position,highlightly_player_id")
    .eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []) as ExistingTeamPlayer[];
}

function findExistingTeamPlayer(players: ExistingTeamPlayer[], apiName?: string | null, highlightlyPlayerId?: number | null) {
  if (highlightlyPlayerId) {
    const byProviderId = players.find((player) => Number(player.highlightly_player_id) === Number(highlightlyPlayerId));
    if (byProviderId) return byProviderId;
  }
  const name = String(apiName ?? "");
  if (!name) return null;
  const exact = players.find((player) => normalizeTeam(player.name) === normalizeTeam(name));
  const similar = players.find((player) => playerNamesMatch(player.name, name));
  return exact ?? similar ?? null;
}

function playerNamesMatch(leftName?: string | null, rightName?: string | null) {
  const left = normalizeTeam(leftName).split(" ").filter((token) => token.length > 1);
  const right = normalizeTeam(rightName).split(" ").filter((token) => token.length > 1);
  if (left.length < 2 || right.length < 2) return false;
  const firstMatches = left[0] === right[0] || left[0][0] === right[0][0];
  const lastMatches = left.at(-1) === right.at(-1);
  if (firstMatches && lastMatches) return true;
  const commonTokens = left.filter((token) => right.includes(token));
  return commonTokens.length >= 2;
}

function dateInRecife(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseEventMinute(value: unknown) {
  const [minute, extraMinute] = String(value ?? "").split("+").map((part) => Number.parseInt(part, 10));
  return {
    minute: Number.isFinite(minute) ? minute : null,
    extraMinute: Number.isFinite(extraMinute) ? extraMinute : null,
  };
}

function mapHighlightlyEventType(value?: string | null) {
  const type = String(value ?? "").toLowerCase();
  if (type === "goal") return "goal";
  if (type === "own goal") return "own_goal";
  if (type === "penalty") return "penalty";
  if (type === "missed penalty") return "missed_penalty";
  if (type === "yellow card") return "yellow_card";
  if (type === "red card") return "red_card";
  if (type === "substitution") return "substitution";
  if (type.startsWith("var")) return "var";
  return "other";
}

function highlightlyEventKey(matchId: string, event: any) {
  return [
    matchId,
    event.type ?? "other",
    event.time ?? "",
    event.playerId ?? normalizeTeam(event.player),
    normalizeTeam(event.substituted),
  ].join(":");
}

function dedupeAppearanceRows(rows: Array<Record<string, unknown>>) {
  const unique = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = `${row.match_id}:${row.player_id}`;
    const previous = unique.get(key);
    unique.set(key, previous ? {
      ...previous,
      started: Boolean(previous.started || row.started),
      bench: Boolean(previous.bench || row.bench),
      entered: Boolean(previous.entered || row.entered),
    } : row);
  }
  return Array.from(unique.values()).map((row) => ({
    ...row,
    bench: Boolean(row.bench) && !Boolean(row.started),
  }));
}

function dedupeHighlightlyEvents(rows: Array<Record<string, unknown>>) {
  return Array.from(new Map(rows.map((row) => [String(row.highlightly_event_key), row])).values());
}

function findHighlightlyMatch(highlightlyMatches: any[], match: DbMatch) {
  return highlightlyMatches.find((candidate) =>
    closeKickoff(match.match_date, candidate.date) &&
    teamMatches(match.home_team?.name, candidate.homeTeam?.name) &&
    teamMatches(match.away_team?.name, candidate.awayTeam?.name)
  );
}

async function getHighlightlyCandidates(admin: AdminClient, season: string): Promise<DbMatch[]> {
  const since = new Date(Date.now() - 36 * 60 * 60_000).toISOString();
  const retryBefore = new Date(Date.now() - highlightlyRetryMinutes * 60_000).toISOString();
  const { data, error } = await admin
    .from("matches")
    .select("id, api_fixture_id, home_team_id, away_team_id, match_date, status, home_score, away_score, highlightly_import_attempts, home_team:home_team_id(name,country), away_team:away_team_id(name,country)")
    .eq("status", "finished")
    .gte("match_date", `${season}-01-01T00:00:00Z`)
    .gte("match_date", since)
    .is("highlightly_imported_at", null)
    .or(`highlightly_last_attempt_at.is.null,highlightly_last_attempt_at.lt.${retryBefore}`)
    .order("match_date", { ascending: false })
    .limit(20);
  if (error) throw error;

  const candidates = (data ?? []) as unknown as DbMatch[];
  if (candidates.length === 0) return [];
  const targetDate = dateInRecife(candidates[0].match_date);
  return candidates
    .filter((match) => dateInRecife(match.match_date) === targetDate)
    .slice(0, maxHighlightlyMatchesPerRun);
}

async function highlightlyRequest(apiKey: string, path: string) {
  const response = await fetch(`https://${highlightlyHost}${path}`, {
    headers: {
      "x-rapidapi-host": highlightlyHost,
      "x-rapidapi-key": apiKey,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) throw new Error(`Highlightly ${path} returned ${response.status}: ${JSON.stringify(payload.error ?? payload.message ?? payload)}`);
  return payload;
}

async function syncHighlightlyMatchDetails(admin: AdminClient, now: string, season: string): Promise<FallbackResult> {
  const apiKey = Deno.env.get("HIGHLIGHTLY_RAPIDAPI_KEY");
  if (!apiKey) return { configured: false, attempted: false, skipped_reason: "HIGHLIGHTLY_RAPIDAPI_KEY is not configured" };

  const candidates = await getHighlightlyCandidates(admin, season);
  if (candidates.length === 0) return { configured: true, attempted: false, skipped_reason: "No recently finished matches pending Highlightly details" };

  const run = await admin.from("sync_runs")
    .insert({ kind: "live", provider: "highlightly-match-details", status: "running" })
    .select("id").single();
  if (run.error) throw run.error;

  try {
    const matchDate = dateInRecife(candidates[0].match_date);
    const dailyMatches = await highlightlyRequest(
      apiKey,
      `/matches?date=${encodeURIComponent(matchDate)}&leagueId=${highlightlyWorldCupLeagueId}&timezone=America%2FRecife&limit=100`,
    );
    const highlightlyMatches = dailyMatches.data ?? [];
    await wait(highlightlyRequestIntervalMs);
    let imported = 0;
    let eventsImported = 0;
    let matched = 0;

    for (const match of candidates) {
      await admin.from("matches").update({
        highlightly_last_attempt_at: now,
        highlightly_import_attempts: (match.highlightly_import_attempts ?? 0) + 1,
      }).eq("id", match.id);

      const highlightlyMatch = findHighlightlyMatch(highlightlyMatches, match);
      if (!highlightlyMatch?.id) continue;
      const lineups = await highlightlyRequest(apiKey, `/lineups/${highlightlyMatch.id}`);
      await wait(highlightlyRequestIntervalMs);
      const events = await highlightlyRequest(apiKey, `/events/${highlightlyMatch.id}`);
      await wait(highlightlyRequestIntervalMs);
      const [homePlayers, awayPlayers] = await Promise.all([
        getExistingTeamPlayers(admin, match.home_team_id),
        getExistingTeamPlayers(admin, match.away_team_id),
      ]);
      const allEvents = Array.isArray(events) ? events : [];
      const enteredNames = allEvents
        .filter((event: any) => String(event.type).toLowerCase() === "substitution")
        .map((event: any) => normalizeTeam(event.substituted))
        .filter(Boolean);
      const sides = [
        { lineup: lineups.homeTeam, teamId: match.home_team_id, players: homePlayers },
        { lineup: lineups.awayTeam, teamId: match.away_team_id, players: awayPlayers },
      ];
      const appearanceRows: Array<Record<string, unknown>> = [];
      for (const side of sides) {
        const starters = (side.lineup?.initialLineup ?? []).flatMap((row: any) => Array.isArray(row) ? row : [row]);
        const bench = side.lineup?.substitutes ?? [];
        for (const entry of [...starters, ...bench]) {
          const player = findExistingTeamPlayer(side.players, entry.name, Number(entry.id));
          if (!player) continue;
          if (player.highlightly_player_id !== Number(entry.id)) {
            const { error: playerError } = await admin.from("players")
              .update({ highlightly_player_id: Number(entry.id) })
              .eq("id", player.id);
            if (playerError) throw playerError;
            player.highlightly_player_id = Number(entry.id);
          }
          const started = starters.some((starter: any) => Number(starter.id) === Number(entry.id));
          appearanceRows.push({
            match_id: match.id,
            player_id: player.id,
            team_id: side.teamId,
            position: player.position,
            started,
            bench: !started,
            entered: enteredNames.some((enteredName) => teamMatches(entry.name, enteredName)),
          });
        }
      }
      const saved = appearanceRows.length > 0
        ? await upsertAppearanceRows(admin, dedupeAppearanceRows(appearanceRows))
        : { count: 0, includesBench: false };
      imported += saved.count;

      const eventRows = allEvents.map((event: any) => {
        const timing = parseEventMinute(event.time);
        const teamId = teamMatches(event.team?.name, match.home_team?.name)
          ? match.home_team_id
          : teamMatches(event.team?.name, match.away_team?.name)
            ? match.away_team_id
            : null;
        return {
          match_id: match.id,
          team_id: teamId,
          player_name: event.player ?? null,
          event_type: mapHighlightlyEventType(event.type),
          minute: timing.minute,
          extra_minute: timing.extraMinute,
          description: event.type ?? null,
          assist_player_name: event.assist || null,
          substituted_player_name: event.substituted || null,
          highlightly_event_key: highlightlyEventKey(match.id, event),
        };
      });
      const uniqueEventRows = dedupeHighlightlyEvents(eventRows);
      if (uniqueEventRows.length > 0) {
        const { error: eventsError } = await admin.from("match_events")
          .upsert(uniqueEventRows, { onConflict: "highlightly_event_key" });
        if (eventsError) throw eventsError;
        eventsImported += uniqueEventRows.length;
      }

      const { error: completeError } = await admin.from("matches").update({
        highlightly_match_id: Number(highlightlyMatch.id),
        highlightly_imported_at: new Date().toISOString(),
        highlightly_last_attempt_at: now,
        best_players_data_source: saved.includesBench && saved.count >= 22 ? "appearances" : "squad",
      }).eq("id", match.id);
      if (completeError) throw completeError;
      matched += 1;
    }

    const result = { configured: true, attempted: true, matches: matched, imported, events: eventsImported, fetched: highlightlyMatches.length };
    await admin.from("sync_runs").update({ status: "success", finished_at: now, request_count: 1 + matched * 2, metadata: result }).eq("id", run.data.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    await admin.from("sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", run.data.id);
    return { configured: true, attempted: true, error: message };
  }
}

async function syncApiSportsFinishedMatchLineups(admin: AdminClient, now: string): Promise<FallbackResult> {
  if (apiSportsIsStandby()) {
    return { configured: true, attempted: false, skipped_reason: "API-Sports is on standby for the 2026 World Cup" };
  }
  const apiKey = Deno.env.get("FOOTBALL_API_KEY");
  const leagueId = Deno.env.get("FOOTBALL_API_LEAGUE_ID") ?? "1";
  const season = Deno.env.get("FOOTBALL_DATA_SEASON") ?? Deno.env.get("FOOTBALL_API_SEASON") ?? "2026";
  if (!apiKey) return { configured: false, attempted: false, skipped_reason: "FOOTBALL_API_KEY is not configured" };
  if (!(await shouldTryApiSportsLineups(admin))) {
    return { configured: true, attempted: false, skipped_reason: "Lineup import interval not reached" };
  }

  const candidates = await getFinishedLineupCandidates(admin, season);
  if (candidates.length === 0) return { configured: true, attempted: false, skipped_reason: "No finished matches pending lineups" };

  const run = await admin
    .from("sync_runs")
    .insert({ kind: "live", provider: "api-sports-lineups", status: "running" })
    .select("id")
    .single();
  if (run.error) throw run.error;

  try {
    const fixturesUrl = new URL("https://v3.football.api-sports.io/fixtures");
    fixturesUrl.searchParams.set("league", leagueId);
    fixturesUrl.searchParams.set("season", season);
    const fixturesResponse = await fetch(fixturesUrl, { headers: { "x-apisports-key": apiKey } });
    const fixturesPayload = await fixturesResponse.json().catch(async () => ({ errors: await fixturesResponse.text(), response: [] }));
    if (!fixturesResponse.ok || (fixturesPayload.errors && Object.keys(fixturesPayload.errors).length > 0)) {
      const reason = `API-Sports fixtures returned ${fixturesResponse.status}: ${JSON.stringify(fixturesPayload.errors)}`;
      if (JSON.stringify(fixturesPayload.errors ?? "").includes("do not have access to this season")) {
        const result = { configured: true, attempted: false, skipped_reason: reason };
        await admin.from("sync_runs").update({ status: "success", finished_at: now, metadata: result }).eq("id", run.data.id);
        return result;
      }
      throw new Error(reason);
    }

    let imported = 0;
    let matchesWithLineups = 0;
    for (const match of candidates) {
      const fixture = findApiSportsFixture(fixturesPayload.response ?? [], match);
      if (!fixture?.fixture?.id) continue;
      const lineupResponse = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixture.fixture.id}`, {
        headers: { "x-apisports-key": apiKey },
      });
      const lineupPayload = await lineupResponse.json().catch(async () => ({ errors: await lineupResponse.text(), response: [] }));
      if (!lineupResponse.ok || (lineupPayload.errors && Object.keys(lineupPayload.errors).length > 0)) {
        throw new Error(`API-Sports lineups returned ${lineupResponse.status}: ${JSON.stringify(lineupPayload.errors)}`);
      }

      const [homePlayers, awayPlayers] = await Promise.all([
        getExistingTeamPlayers(admin, match.home_team_id),
        getExistingTeamPlayers(admin, match.away_team_id),
      ]);
      const sides = [
        { lineup: (lineupPayload.response ?? []).find((item: any) => Number(item.team?.id) === Number(fixture.teams?.home?.id)), teamId: match.home_team_id, players: homePlayers },
        { lineup: (lineupPayload.response ?? []).find((item: any) => Number(item.team?.id) === Number(fixture.teams?.away?.id)), teamId: match.away_team_id, players: awayPlayers },
      ];
      const rows: Array<Record<string, unknown>> = [];
      for (const side of sides) {
        const starters = side.lineup?.startXI ?? [];
        const bench = side.lineup?.substitutes ?? [];
        for (const entry of [...starters, ...bench]) {
          const player = findExistingTeamPlayer(side.players, entry.player?.name);
          if (!player) continue;
          const started = starters.some((starter: any) => starter.player?.id === entry.player?.id);
          rows.push({
            match_id: match.id,
            player_id: player.id,
            team_id: side.teamId,
            position: player.position,
            started,
            bench: !started,
            entered: false,
          });
        }
      }
      if (rows.length > 0) {
        const saved = await upsertAppearanceRows(admin, rows);
        imported += saved.count;
        matchesWithLineups += 1;
      }
    }

    const result = { configured: true, attempted: true, league_id: leagueId, season, matches: candidates.length, matches_with_lineups: matchesWithLineups, imported };
    await admin.from("sync_runs").update({ status: "success", finished_at: now, request_count: candidates.length + 1, metadata: result }).eq("id", run.data.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", run.data.id);
    return { configured: true, attempted: true, error: message };
  }
}

async function applyApiSportsFallback(admin: AdminClient, now: string): Promise<FallbackResult> {
  if (apiSportsIsStandby()) {
    return { configured: true, attempted: false, skipped_reason: "API-Sports is on standby for the 2026 World Cup" };
  }
  const apiKey = Deno.env.get("FOOTBALL_API_KEY");
  const leagueId = Deno.env.get("FOOTBALL_API_LEAGUE_ID") ?? "1";
  const season = Deno.env.get("FOOTBALL_DATA_SEASON") ?? Deno.env.get("FOOTBALL_API_SEASON") ?? "2026";
  if (!apiKey) return { configured: false, attempted: false, skipped_reason: "FOOTBALL_API_KEY is not configured" };

  const candidates = await getFallbackCandidates(admin);
  if (candidates.length === 0) {
    return { configured: true, attempted: false, skipped_reason: "No live-window fallback candidates" };
  }

  if (!(await shouldTryApiSports(admin))) {
    return { configured: true, attempted: false, skipped_reason: "Fallback interval not reached" };
  }

  const run = await admin
    .from("sync_runs")
    .insert({ kind: "live", provider: "api-sports-fallback", status: "running" })
    .select("id")
    .single();
  if (run.error) throw run.error;

  try {
    const url = new URL("https://v3.football.api-sports.io/fixtures");
    url.searchParams.set("league", leagueId);
    url.searchParams.set("season", season);

    const response = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    const payload = await response.json().catch(async () => ({ errors: await response.text(), response: [] }));
    if (!response.ok || (payload.errors && Object.keys(payload.errors).length > 0)) {
      throw new Error(`API-Sports returned ${response.status}: ${JSON.stringify(payload.errors)}`);
    }

    const fixtures: any[] = payload.response ?? [];
    let updated = 0;
    let live = 0;

    for (const candidate of candidates) {
      const fixture = findApiSportsFixture(fixtures, candidate);
      if (!fixture) continue;

      const status = mapApiSportsStatus(fixture.fixture?.status?.short);
      const homeScore = fixture.goals?.home ?? null;
      const awayScore = fixture.goals?.away ?? null;
      if (status === "scheduled" && homeScore === null && awayScore === null) continue;
      if (status === "finished") continue;
      if (status === "live" || status === "halftime") live += 1;
      const preserveScore = shouldPreserveCurrentLiveScore(candidate, status, homeScore, awayScore);

      const { data, error } = await admin
        .from("matches")
        .update({
          status,
          home_score: preserveScore ? candidate.home_score : homeScore,
          away_score: preserveScore ? candidate.away_score : awayScore,
          elapsed: isActiveStatus(status) ? fixture.fixture?.status?.elapsed ?? null : null,
          last_synced_at: now,
        })
        .eq("id", candidate.id)
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) updated += 1;
    }

    const result = { configured: true, attempted: true, league_id: leagueId, season, fetched: fixtures.length, live, updated };
    await admin
      .from("sync_runs")
      .update({ status: "success", finished_at: now, request_count: 1, metadata: result })
      .eq("id", run.data.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("sync_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", run.data.id);
    return { configured: true, attempted: true, error: message };
  }
}

function mapWorldCup26Status(game: any): string {
  const elapsed = String(game.time_elapsed ?? "").toLowerCase();
  const finished = String(game.finished ?? "").toUpperCase() === "TRUE";
  if (finished || elapsed === "finished" || elapsed === "fulltime") return "finished";
  if (elapsed === "live" || elapsed === "inplay" || elapsed === "1h" || elapsed === "2h") return "live";
  if (elapsed === "halftime" || elapsed === "ht") return "halftime";
  return "scheduled";
}

function parseWorldCup26Score(value: unknown) {
  const score = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(score) && score >= 0 ? score : null;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWorldCup26Games() {
  const attempts = 2;
  const errors: string[] = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch("https://worldcup26.ir/get/games", {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "cache-control": "no-cache",
          "user-agent": "palpito-live-sync/1.0",
        },
      });
      const rawBody = await response.text();
      let payload: any = { games: [] };
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = { error: rawBody.slice(0, 500), games: [] };
      }
      if (!response.ok) {
        throw new Error(`worldcup26.ir returned ${response.status}: ${JSON.stringify(payload)}`);
      }
      return { games: (payload.games ?? []) as any[], attempts: attempt };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      if (attempt < attempts) await wait(1_000 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`worldcup26.ir failed after ${attempts} attempts: ${errors.join(" | ")}`);
}

function findWorldCup26Game(games: any[], match: DbMatch) {
  return games.find((game) =>
    teamMatches(match.home_team?.name, game.home_team_name_en) &&
    teamMatches(match.away_team?.name, game.away_team_name_en)
  );
}

async function applyWorldCup26Fallback(admin: AdminClient, now: string): Promise<FallbackResult> {
  const candidates = await getFallbackCandidates(admin);
  if (candidates.length === 0) {
    return { configured: true, attempted: false, skipped_reason: "No live-window fallback candidates" };
  }

  if (!(await shouldTryWorldCup26(admin))) {
    return { configured: true, attempted: false, skipped_reason: "Fallback interval not reached" };
  }

  const run = await admin
    .from("sync_runs")
    .insert({ kind: "live", provider: "worldcup26-fallback", status: "running" })
    .select("id")
    .single();
  if (run.error) throw run.error;

  try {
    const { games, attempts } = await fetchWorldCup26Games();
    let updated = 0;
    let live = 0;

    for (const candidate of candidates) {
      const game = findWorldCup26Game(games, candidate);
      if (!game) continue;

      const status = mapWorldCup26Status(game);
      const homeScore = parseWorldCup26Score(game.home_score);
      const awayScore = parseWorldCup26Score(game.away_score);
      if (status === "scheduled") continue;
      if (homeScore === null || awayScore === null) continue;
      // worldcup26.ir is only a fast live fallback. Final results must come from the
      // primary provider to avoid stale/incorrect finals overwriting the official score.
      if (status === "finished") continue;
      if (status === "live" || status === "halftime") live += 1;
      const preserveScore = shouldPreserveCurrentLiveScore(candidate, status, homeScore, awayScore);

      const { data, error } = await admin
        .from("matches")
        .update({
          status,
          home_score: preserveScore ? candidate.home_score : homeScore,
          away_score: preserveScore ? candidate.away_score : awayScore,
          elapsed: null,
          last_synced_at: now,
        })
        .eq("id", candidate.id)
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) updated += 1;
    }

    const result = { configured: true, attempted: true, attempts, fetched: games.length, live, updated };
    await admin
      .from("sync_runs")
      .update({ status: "success", finished_at: now, request_count: 1, metadata: result })
      .eq("id", run.data.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("sync_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", run.data.id);
    return { configured: true, attempted: true, error: message };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authError = requireInternalSecret(req);
  if (authError) {
    return json(authError.includes("configured") ? 500 : 401, { error: authError });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN") ?? Deno.env.get("FOOTBALL_DATA_API_KEY");
  const competition = Deno.env.get("FOOTBALL_DATA_COMPETITION") ?? "WC";
  const season = Deno.env.get("FOOTBALL_DATA_SEASON") ?? "2026";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Supabase service credentials are not configured" });
  }
  if (!apiToken) {
    return json(500, { error: "FOOTBALL_DATA_API_TOKEN is not configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
  });

  const run = await admin
    .from("sync_runs")
    .insert({ kind: "live", provider: "football-data", status: "running" })
    .select("id")
    .single();
  if (run.error) return json(500, { error: run.error.message });

  try {
    const url = new URL(`https://api.football-data.org/v4/competitions/${competition}/matches`);
    url.searchParams.set("season", season);
    const { data: initialBestPlayerLifecycle } = await admin.rpc("process_best_player_windows");
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": apiToken,
        "X-Unfold-Lineups": "true",
        "X-Unfold-Subs": "true",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      throw new Error(`football-data.org returned ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    const matches: any[] = payload.matches ?? [];
    let updated = 0;
    let live = 0;
    const now = new Date().toISOString();
    const apiFixtureIds = matches.map((match) => match.id).filter((id) => id !== null && id !== undefined);
    const existingByFixtureId = new Map<number, {
      id: string;
      home_team_id: string;
      away_team_id: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
    }>();

    if (apiFixtureIds.length > 0) {
      const { data: existingMatches, error: existingError } = await admin
        .from("matches")
        .select("id, api_fixture_id, home_team_id, away_team_id, status, home_score, away_score")
        .in("api_fixture_id", apiFixtureIds);
      if (existingError) throw existingError;

      for (const match of existingMatches ?? []) {
        if (match.api_fixture_id === null || match.api_fixture_id === undefined) continue;
        existingByFixtureId.set(Number(match.api_fixture_id), {
          id: match.id,
          home_team_id: match.home_team_id,
          away_team_id: match.away_team_id,
          status: match.status,
          home_score: match.home_score,
          away_score: match.away_score,
        });
      }
    }

    let unfoldedAppearances = 0;
    for (const m of matches) {
      const status = mapFootballDataStatus(m.status);
      if (status === "live" || status === "halftime") live += 1;
      const homeScore = m.score?.fullTime?.home ?? null;
      const awayScore = m.score?.fullTime?.away ?? null;
      const current = existingByFixtureId.get(Number(m.id));
      const preserveScore = shouldPreserveCurrentLiveScore(current, status, homeScore, awayScore);

      const { data, error } = await admin
        .from("matches")
        .update({
          status,
          home_score: preserveScore ? current?.home_score ?? homeScore : homeScore,
          away_score: preserveScore ? current?.away_score ?? awayScore : awayScore,
          elapsed: m.minute ?? null,
          last_synced_at: now,
        })
        .eq("api_fixture_id", m.id)
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) updated += 1;
      if (status === "finished" && current) {
        unfoldedAppearances += await importUnfoldedMatchRoster(admin, m, current);
      }
    }

    const playerSync = await syncFinishedMatchPlayers(admin, apiToken, season);
    const highlightlyDetails = await syncHighlightlyMatchDetails(admin, now, season);
    const apiSportsLineups = await syncApiSportsFinishedMatchLineups(admin, now);
    const { data: bestPlayerLifecycle, error: lifecycleError } = await admin.rpc("process_best_player_windows");
    if (lifecycleError) throw lifecycleError;

    const apiSportsFallback = await applyApiSportsFallback(admin, now);
    const worldCup26Fallback = await applyWorldCup26Fallback(admin, now);

    await admin
      .from("sync_runs")
      .update({
        status: "success",
        finished_at: now,
        request_count: 1,
        metadata: {
          fetched: matches.length,
          updated,
          live,
          player_sync: playerSync,
          highlightly_match_details: highlightlyDetails,
          unfolded_appearances: unfoldedAppearances,
          api_sports_lineups: apiSportsLineups,
          best_player_lifecycle: { initial: initialBestPlayerLifecycle, final: bestPlayerLifecycle },
          api_sports_fallback: apiSportsFallback,
          worldcup26_fallback: worldCup26Fallback,
        },
      })
      .eq("id", run.data.id);

    return json(200, {
      status: "success",
      fetched: matches.length,
      updated,
      live,
      player_sync: playerSync,
      highlightly_match_details: highlightlyDetails,
      unfolded_appearances: unfoldedAppearances,
      api_sports_lineups: apiSportsLineups,
      best_player_lifecycle: { initial: initialBestPlayerLifecycle, final: bestPlayerLifecycle },
      api_sports_fallback: apiSportsFallback,
      worldcup26_fallback: worldCup26Fallback,
    });
  } catch (error) {
    const { data: bestPlayerLifecycle } = await admin.rpc("process_best_player_windows").catch(() => ({ data: null }));
    await admin
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", run.data.id);
    return json(500, {
      error: error instanceof Error ? error.message : String(error),
      best_player_lifecycle: bestPlayerLifecycle,
    });
  }
});
