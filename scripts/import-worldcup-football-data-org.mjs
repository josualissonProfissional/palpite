#!/usr/bin/env node

const apiKey = process.env.FOOTBALL_DATA_API_KEY;
const season = Number(process.env.FOOTBALL_DATA_SEASON ?? 2026);
const competitionCode = process.env.FOOTBALL_DATA_COMPETITION ?? "WC";

if (!apiKey) {
  console.error("FOOTBALL_DATA_API_KEY is required");
  process.exit(1);
}

const baseUrl = "https://api.football-data.org/v4";

async function apiGet(path, params = {}) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { "X-Auth-Token": apiKey },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`football-data.org ${path} returned ${response.status}: ${body}`);
  }

  return response.json();
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function groupName(value) {
  if (!value) return null;
  const match = String(value).match(/^GROUP_([A-Z])$/);
  return match ? `Group ${match[1]}` : String(value).replaceAll("_", " ");
}

function stageFromFootballData(stage) {
  switch (stage) {
    case "GROUP_STAGE":
      return "group_stage";
    case "LAST_32":
      return "round_of_32";
    case "LAST_16":
      return "round_of_16";
    case "QUARTER_FINALS":
      return "quarter_final";
    case "SEMI_FINALS":
      return "semi_final";
    case "THIRD_PLACE":
      return "third_place";
    case "FINAL":
      return "final";
    default:
      return "group_stage";
  }
}

function statusFromFootballData(status) {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return status === "PAUSED" ? "halftime" : "live";
    case "FINISHED":
      return "finished";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

function winnerId(match) {
  if (match.score?.winner === "HOME_TEAM") return match.homeTeam?.id ?? null;
  if (match.score?.winner === "AWAY_TEAM") return match.awayTeam?.id ?? null;
  return null;
}

function uniqTeams(matches) {
  const teams = new Map();
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (!team?.id) continue;
      teams.set(team.id, {
        api_team_id: team.id,
        name: team.name,
        country: team.tla ?? null,
        logo_url: team.crest ?? null,
      });
    }
  }
  return [...teams.values()].sort((a, b) => a.api_team_id - b.api_team_id);
}

function buildGroupStandings(matches) {
  const rowsByKey = new Map();

  for (const match of matches) {
    const group = groupName(match.group);
    if (!group || match.stage !== "GROUP_STAGE") continue;

    for (const side of ["homeTeam", "awayTeam"]) {
      const team = match[side];
      if (!team?.id) continue;
      const key = `${group}:${team.id}`;
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          group_name: group,
          api_team_id: team.id,
          name: team.name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          goal_difference: 0,
          points: 0,
        });
      }
    }

    if (match.status !== "FINISHED") continue;

    const home = rowsByKey.get(`${group}:${match.homeTeam.id}`);
    const away = rowsByKey.get(`${group}:${match.awayTeam.id}`);
    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;
    if (!home || !away || homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
      continue;
    }

    home.played += 1;
    away.played += 1;
    home.goals_for += homeScore;
    home.goals_against += awayScore;
    away.goals_for += awayScore;
    away.goals_against += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (awayScore > homeScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goal_difference = home.goals_for - home.goals_against;
    away.goal_difference = away.goals_for - away.goals_against;
  }

  const grouped = new Map();
  for (const row of rowsByKey.values()) {
    if (!grouped.has(row.group_name)) grouped.set(row.group_name, []);
    grouped.get(row.group_name).push(row);
  }

  const standings = [];
  for (const rows of [...grouped.values()].sort((a, b) => a[0].group_name.localeCompare(b[0].group_name))) {
    rows.sort((a, b) => {
      return (
        b.points - a.points ||
        b.goal_difference - a.goal_difference ||
        b.goals_for - a.goals_for ||
        a.name.localeCompare(b.name)
      );
    });
    rows.forEach((row, index) => standings.push({ ...row, position: index + 1 }));
  }

  return standings;
}

const matchesPayload = await apiGet(`/competitions/${competitionCode}/matches`, { season });
const matches = matchesPayload.matches ?? [];
const teams = uniqTeams(matches);
const standings = buildGroupStandings(matches);

const dates = matches.map((match) => match.utcDate?.slice(0, 10)).filter(Boolean).sort();
const startDate = matchesPayload.competition?.currentSeason?.startDate ?? dates[0] ?? `${season}-01-01`;
const endDate = matchesPayload.competition?.currentSeason?.endDate ?? dates.at(-1) ?? `${season}-12-31`;
const competitionName = matchesPayload.competition?.name ?? "FIFA World Cup";
const apiLeagueId = matchesPayload.competition?.id ?? 2000;

const lines = [];
lines.push("begin;");
lines.push(`
insert into palpite.competitions (name, season, api_league_id, api_season, start_date, end_date)
values (${sql(competitionName)}, ${sql(String(season))}, ${sql(apiLeagueId)}, ${sql(season)}, ${sql(startDate)}, ${sql(endDate)})
on conflict (name, season) do update set
  api_league_id = excluded.api_league_id,
  api_season = excluded.api_season,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  updated_at = now();
`);

if (teams.length > 0) {
  lines.push(`
insert into palpite.teams (api_team_id, name, country, logo_url)
values
${teams.map((team) => `  (${sql(team.api_team_id)}, ${sql(team.name)}, ${sql(team.country)}, ${sql(team.logo_url)})`).join(",\n")}
on conflict (api_team_id) do update set
  name = excluded.name,
  country = excluded.country,
  logo_url = excluded.logo_url,
  updated_at = now();
`);
}

for (const match of matches) {
  const homeApiId = match.homeTeam?.id ?? null;
  const awayApiId = match.awayTeam?.id ?? null;
  const matchWinnerId = winnerId(match);

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
  ${sql(match.id)},
  (select id from palpite.competitions where name = ${sql(competitionName)} and season = ${sql(String(season))}),
  ${homeApiId ? `(select id from palpite.teams where api_team_id = ${sql(homeApiId)})` : "null"},
  ${awayApiId ? `(select id from palpite.teams where api_team_id = ${sql(awayApiId)})` : "null"},
  ${sql(groupName(match.group))},
  ${sql(match.matchday ? `Matchday ${match.matchday}` : match.stage)},
  ${sql(stageFromFootballData(match.stage))}::palpite.match_stage,
  ${sql(match.utcDate)}::timestamptz,
  ${sql(statusFromFootballData(match.status))}::palpite.match_status,
  null,
  ${sql(match.score?.fullTime?.home)},
  ${sql(match.score?.fullTime?.away)},
  ${matchWinnerId ? `(select id from palpite.teams where api_team_id = ${sql(matchWinnerId)})` : "null"},
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
  (select id from palpite.competitions where name = ${sql(competitionName)} and season = ${sql(String(season))}),
  (select id from palpite.teams where api_team_id = ${sql(row.api_team_id)}),
  ${sql(row.group_name)},
  ${sql(row.position)},
  ${sql(row.played)},
  ${sql(row.won)},
  ${sql(row.drawn)},
  ${sql(row.lost)},
  ${sql(row.goals_for)},
  ${sql(row.goals_against)},
  ${sql(row.goal_difference)},
  ${sql(row.points)},
  now()
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
console.error(`Generated football-data.org import for ${matches.length} matches, ${teams.length} teams, ${standings.length} standings rows.`);
