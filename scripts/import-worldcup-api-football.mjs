#!/usr/bin/env node

const apiKey = process.env.FOOTBALL_API_KEY;
const leagueId = Number(process.env.FOOTBALL_API_LEAGUE_ID ?? 1);
const season = Number(process.env.FOOTBALL_API_SEASON ?? 2022);

if (!apiKey) {
  console.error("FOOTBALL_API_KEY is required");
  process.exit(1);
}

const baseUrl = "https://v3.football.api-sports.io";

async function apiGet(path, params) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
  });

  if (!response.ok) {
    throw new Error(`API-Football ${path} returned ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload.errors) ? payload.errors.length : Object.keys(payload.errors ?? {}).length) {
    throw new Error(`API-Football error: ${JSON.stringify(payload.errors)}`);
  }

  return payload.response ?? [];
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stageFromRound(round) {
  const value = String(round ?? "").toLowerCase();
  if (value.includes("round of 16")) return "round_of_16";
  if (value.includes("quarter")) return "quarter_final";
  if (value.includes("semi")) return "semi_final";
  if (value.includes("3rd") || value.includes("third")) return "third_place";
  if (value.includes("final")) return "final";
  return "group_stage";
}

function statusFromShort(short) {
  switch (short) {
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

function uniqByApiTeamId(values) {
  const map = new Map();
  for (const team of values) {
    if (team?.api_team_id) map.set(team.api_team_id, team);
  }
  return [...map.values()].sort((a, b) => a.api_team_id - b.api_team_id);
}

const fixtures = await apiGet("/fixtures", { league: leagueId, season });
const standingsResponse = await apiGet("/standings", { league: leagueId, season });
const standingsGroups = standingsResponse[0]?.league?.standings ?? [];
const standings = standingsGroups.flat();

const teamGroupByApiId = new Map();
for (const row of standings) {
  teamGroupByApiId.set(row.team.id, row.group);
}

const teams = uniqByApiTeamId([
  ...fixtures.flatMap((fixture) => [
    {
      api_team_id: fixture.teams.home.id,
      name: fixture.teams.home.name,
      logo_url: fixture.teams.home.logo,
    },
    {
      api_team_id: fixture.teams.away.id,
      name: fixture.teams.away.name,
      logo_url: fixture.teams.away.logo,
    },
  ]),
  ...standings.map((row) => ({
    api_team_id: row.team.id,
    name: row.team.name,
    logo_url: row.team.logo,
  })),
]);

const dates = fixtures
  .map((fixture) => fixture.fixture?.date?.slice(0, 10))
  .filter(Boolean)
  .sort();
const startDate = dates[0] ?? `${season}-01-01`;
const endDate = dates.at(-1) ?? `${season}-12-31`;

const lines = [];
lines.push("begin;");
lines.push(`
insert into palpite.competitions (name, season, api_league_id, api_season, start_date, end_date)
values (${sql("FIFA World Cup")}, ${sql(String(season))}, ${sql(leagueId)}, ${sql(season)}, ${sql(startDate)}, ${sql(endDate)})
on conflict (name, season) do update set
  api_league_id = excluded.api_league_id,
  api_season = excluded.api_season,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  updated_at = now();
`);

if (teams.length > 0) {
  lines.push(`
insert into palpite.teams (api_team_id, name, logo_url)
values
${teams.map((team) => `  (${sql(team.api_team_id)}, ${sql(team.name)}, ${sql(team.logo_url)})`).join(",\n")}
on conflict (api_team_id) do update set
  name = excluded.name,
  logo_url = excluded.logo_url,
  updated_at = now();
`);
}

for (const fixture of fixtures) {
  const homeApiId = fixture.teams.home.id;
  const awayApiId = fixture.teams.away.id;
  const homeGroup = teamGroupByApiId.get(homeApiId);
  const awayGroup = teamGroupByApiId.get(awayApiId);
  const groupName = homeGroup && homeGroup === awayGroup ? homeGroup : null;
  const winnerApiId = fixture.teams.home.winner
    ? homeApiId
    : fixture.teams.away.winner
      ? awayApiId
      : null;

  lines.push(`
insert into palpite.matches (
  api_fixture_id,
  competition_id,
  home_team_id,
  away_team_id,
  group_name,
  round_name,
  stage,
  match_date,
  status,
  elapsed,
  home_score,
  away_score,
  winner_team_id,
  last_synced_at
)
values (
  ${sql(fixture.fixture.id)},
  (select id from palpite.competitions where name = ${sql("FIFA World Cup")} and season = ${sql(String(season))}),
  (select id from palpite.teams where api_team_id = ${sql(homeApiId)}),
  (select id from palpite.teams where api_team_id = ${sql(awayApiId)}),
  ${sql(groupName)},
  ${sql(fixture.league.round)},
  ${sql(stageFromRound(fixture.league.round))}::palpite.match_stage,
  ${sql(fixture.fixture.date)}::timestamptz,
  ${sql(statusFromShort(fixture.fixture.status?.short))}::palpite.match_status,
  ${sql(fixture.fixture.status?.elapsed)},
  ${sql(fixture.goals?.home)},
  ${sql(fixture.goals?.away)},
  ${winnerApiId ? `(select id from palpite.teams where api_team_id = ${sql(winnerApiId)})` : "null"},
  now()
)
on conflict (api_fixture_id) do update set
  competition_id = excluded.competition_id,
  home_team_id = excluded.home_team_id,
  away_team_id = excluded.away_team_id,
  group_name = excluded.group_name,
  round_name = excluded.round_name,
  stage = excluded.stage,
  match_date = excluded.match_date,
  status = excluded.status,
  elapsed = excluded.elapsed,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  winner_team_id = excluded.winner_team_id,
  last_synced_at = excluded.last_synced_at,
  updated_at = now();
`);
}

for (const row of standings) {
  lines.push(`
insert into palpite.standings (
  competition_id,
  team_id,
  group_name,
  position,
  played,
  won,
  drawn,
  lost,
  goals_for,
  goals_against,
  goal_difference,
  points,
  synced_at
)
values (
  (select id from palpite.competitions where name = ${sql("FIFA World Cup")} and season = ${sql(String(season))}),
  (select id from palpite.teams where api_team_id = ${sql(row.team.id)}),
  ${sql(row.group)},
  ${sql(row.rank)},
  ${sql(row.all?.played ?? 0)},
  ${sql(row.all?.win ?? 0)},
  ${sql(row.all?.draw ?? 0)},
  ${sql(row.all?.lose ?? 0)},
  ${sql(row.all?.goals?.for ?? 0)},
  ${sql(row.all?.goals?.against ?? 0)},
  ${sql(row.goalsDiff ?? 0)},
  ${sql(row.points ?? 0)},
  ${sql(row.update ?? new Date().toISOString())}::timestamptz
)
on conflict (competition_id, team_id, group_name) do update set
  position = excluded.position,
  played = excluded.played,
  won = excluded.won,
  drawn = excluded.drawn,
  lost = excluded.lost,
  goals_for = excluded.goals_for,
  goals_against = excluded.goals_against,
  goal_difference = excluded.goal_difference,
  points = excluded.points,
  synced_at = excluded.synced_at;
`);
}

lines.push("commit;");
console.log(lines.join("\n"));
console.error(`Generated import for ${fixtures.length} fixtures, ${teams.length} teams, ${standings.length} standings rows.`);

