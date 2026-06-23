import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  ensureActiveMember,
  handleError,
  handleOptions,
  HttpError,
  json,
  readJson,
  requireString,
  requireUser,
} from "../_shared/backend.ts";

function requireScore(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 99) {
    throw new HttpError(400, `${field} must be an integer between 0 and 99`);
  }

  return value;
}

function requireGoalSelections(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "goal_selections must be an array");
  }

  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

async function requirePredictionLockAt(
  admin: ReturnType<typeof createAdminClient>,
  groupId: string,
  matchId: string,
) {
  const [matchResponse, groupResponse, scoringRulesResponse] = await Promise.all([
    admin
      .from("matches")
      .select("match_date, status")
      .eq("id", matchId)
      .maybeSingle(),
    admin
      .from("groups")
      .select("created_at")
      .eq("id", groupId)
      .maybeSingle(),
    admin
      .from("scoring_rules")
      .select("lock_prediction_minutes_before")
      .eq("group_id", groupId)
      .maybeSingle(),
  ]);

  if (matchResponse.error) throw matchResponse.error;
  if (groupResponse.error) throw groupResponse.error;
  if (scoringRulesResponse.error) throw scoringRulesResponse.error;

  if (!matchResponse.data || !groupResponse.data || !scoringRulesResponse.data) {
    throw new HttpError(404, "Match or scoring rules not found");
  }

  const matchDate = new Date(matchResponse.data.match_date).getTime();
  const groupCreatedAt = new Date(groupResponse.data.created_at).getTime();

  if (matchResponse.data.status !== "scheduled" || matchDate < groupCreatedAt) {
    return Number.NEGATIVE_INFINITY;
  }

  return matchDate - scoringRulesResponse.data.lock_prediction_minutes_before * 60_000;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const body = await readJson(req);

    const groupId = requireString(body.group_id, "group_id");
    const matchId = requireString(body.match_id, "match_id");
    const predictedHomeScore = requireScore(body.predicted_home_score, "predicted_home_score");
    const predictedAwayScore = requireScore(body.predicted_away_score, "predicted_away_score");
    const goalSelections = requireGoalSelections(body.goal_selections);

    await ensureActiveMember(admin, groupId, user.id);

    const predictionLockAt = await requirePredictionLockAt(admin, groupId, matchId);
    if (predictionLockAt <= Date.now()) {
      throw new HttpError(423, "Prediction is locked for this match");
    }

    const { data, error } = await admin.rpc("save_prediction_with_goal_selections", {
      p_group_id: groupId,
      p_user_id: user.id,
      p_match_id: matchId,
      p_predicted_home_score: predictedHomeScore,
      p_predicted_away_score: predictedAwayScore,
      p_goal_selections: goalSelections,
    });
    if (error) throw error;

    const prediction = Array.isArray(data) ? data[0] : data;

    return json(200, { prediction });
  } catch (error) {
    console.error("save-prediction error", error);
    return handleError(error);
  }
});
