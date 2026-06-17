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

    await ensureActiveMember(admin, groupId, user.id);

    const predictionLockAt = await requirePredictionLockAt(admin, groupId, matchId);
    if (predictionLockAt <= Date.now()) {
      throw new HttpError(423, "Prediction is locked for this match");
    }

    const { data: prediction, error } = await admin
      .from("predictions")
      .upsert(
        {
          group_id: groupId,
          user_id: user.id,
          match_id: matchId,
          predicted_home_score: predictedHomeScore,
          predicted_away_score: predictedAwayScore,
        },
        { onConflict: "group_id,user_id,match_id" },
      )
      .select("id, group_id, user_id, match_id, predicted_home_score, predicted_away_score, updated_at")
      .single();
    if (error) throw error;

    return json(200, { prediction });
  } catch (error) {
    console.error("save-prediction error", error);
    return handleError(error);
  }
});
