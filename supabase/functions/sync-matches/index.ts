import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type NormalizedTeam = {
  api_team_id: number;
  name: string;
  country?: string | null;
  logo_url?: string | null;
};

type NormalizedFixture = {
  api_fixture_id: number;
  home_team: NormalizedTeam;
  away_team: NormalizedTeam;
  group_name?: string | null;
  round_name?: string | null;
  stage?: string;
  match_date: string;
  status?: string;
  elapsed?: number | null;
  home_score?: number | null;
  away_score?: number | null;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requireInternalSecret(req: Request) {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected) {
    return "INTERNAL_FUNCTION_SECRET is not configured";
  }

  const received = req.headers.get("x-internal-secret");
  if (received !== expected) {
    return "Invalid internal secret";
  }

  return null;
}

function mapFixtureStatus(shortStatus?: string): string {
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

function normalizeApiSportsFixture(item: any): NormalizedFixture {
  return {
    api_fixture_id: item.fixture.id,
    home_team: {
      api_team_id: item.teams.home.id,
      name: item.teams.home.name,
      country: item.teams.home.country ?? null,
      logo_url: item.teams.home.logo ?? null,
    },
    away_team: {
      api_team_id: item.teams.away.id,
      name: item.teams.away.name,
      country: item.teams.away.country ?? null,
      logo_url: item.teams.away.logo ?? null,
    },
    group_name: item.league?.round?.startsWith("Group") ? item.league.round : null,
    round_name: item.league?.round ?? null,
    stage: "group_stage",
    match_date: item.fixture.date,
    status: mapFixtureStatus(item.fixture.status?.short),
    elapsed: item.fixture.status?.elapsed ?? null,
    home_score: item.goals?.home ?? null,
    away_score: item.goals?.away ?? null,
  };
}

async function fetchFixturesFromProvider(): Promise<NormalizedFixture[]> {
  const apiKey = Deno.env.get("FOOTBALL_API_KEY");
  const leagueId = Deno.env.get("FOOTBALL_API_LEAGUE_ID");
  const season = Deno.env.get("FOOTBALL_API_SEASON") ?? "2026";

  if (!apiKey || !leagueId) {
    return [];
  }

  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("league", leagueId);
  url.searchParams.set("season", season);

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football returned ${response.status}`);
  }

  const payload = await response.json();
  return (payload.response ?? []).map(normalizeApiSportsFixture);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authError = requireInternalSecret(req);
  if (authError) {
    return json(authError.includes("configured") ? 500 : 401, { error: authError });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Supabase service credentials are not configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
  });

  const body = await req.json().catch(() => ({}));
  const competitionId = body.competition_id as string | undefined;

  const run = await admin
    .from("sync_runs")
    .insert({ kind: "matches", provider: "api-football", status: "running" })
    .select("id")
    .single();

  if (run.error) {
    return json(500, { error: run.error.message });
  }

  try {
    const fixtures: NormalizedFixture[] = Array.isArray(body.fixtures)
      ? body.fixtures
      : await fetchFixturesFromProvider();

    if (!competitionId) {
      throw new Error("competition_id is required");
    }

    if (fixtures.length === 0) {
      await admin
        .from("sync_runs")
        .update({
          status: "skipped",
          finished_at: new Date().toISOString(),
          metadata: { reason: "No fixtures provided and provider env vars are incomplete" },
        })
        .eq("id", run.data.id);

      return json(200, { status: "skipped", synced: 0 });
    }

    let synced = 0;

    for (const fixture of fixtures) {
      const { data: homeTeam, error: homeError } = await admin
        .from("teams")
        .upsert(fixture.home_team, { onConflict: "api_team_id" })
        .select("id")
        .single();
      if (homeError) throw homeError;

      const { data: awayTeam, error: awayError } = await admin
        .from("teams")
        .upsert(fixture.away_team, { onConflict: "api_team_id" })
        .select("id")
        .single();
      if (awayError) throw awayError;

      const { error: matchError } = await admin.from("matches").upsert(
        {
          api_fixture_id: fixture.api_fixture_id,
          competition_id: competitionId,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          group_name: fixture.group_name ?? null,
          round_name: fixture.round_name ?? null,
          stage: fixture.stage ?? "group_stage",
          match_date: fixture.match_date,
          status: fixture.status ?? "scheduled",
          elapsed: fixture.elapsed ?? null,
          home_score: fixture.home_score ?? null,
          away_score: fixture.away_score ?? null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "api_fixture_id" },
      );
      if (matchError) throw matchError;

      synced += 1;
    }

    await admin
      .from("sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        request_count: Array.isArray(body.fixtures) ? 0 : 1,
        metadata: { synced },
      })
      .eq("id", run.data.id);

    return json(200, { status: "success", synced });
  } catch (error) {
    await admin
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", run.data.id);

    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
