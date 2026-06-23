import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  handleError,
  handleOptions,
  HttpError,
  json,
  readJson,
  requireString,
  requireUser,
} from "../_shared/backend.ts";

type ActiveGroup = {
  group_id: string;
  group: {
    id: string;
    name: string;
  } | null;
};

type ExistingPrediction = {
  group_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
};

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

function scoreKey(home: number, away: number) {
  return `${home}:${away}`;
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
    const resolveConflict = body.resolve_conflict === true;
    const hasGoalSelections = Object.prototype.hasOwnProperty.call(body, "goal_selections");
    const goalSelections = hasGoalSelections ? requireGoalSelections(body.goal_selections) : null;

    const { data: activeGroupsData, error: activeGroupsError } = await admin
      .from("group_members")
      .select("group_id, group:group_id(id,name)")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (activeGroupsError) throw activeGroupsError;

    const activeGroups = (activeGroupsData ?? []) as unknown as ActiveGroup[];
    if (!activeGroups.some((group) => group.group_id === groupId)) {
      throw new HttpError(403, "User is not an active member of this group");
    }

    if (activeGroups.length === 0) {
      throw new HttpError(404, "No active groups found");
    }

    const groupIds = activeGroups.map((group) => group.group_id);
    const groupNameById = new Map(
      activeGroups.map((group) => [group.group_id, group.group?.name ?? "Grupo"]),
    );

    const { data: existingData, error: existingError } = await admin
      .from("predictions")
      .select("group_id, predicted_home_score, predicted_away_score")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .in("group_id", groupIds);

    if (existingError) throw existingError;

    const existing = (existingData ?? []) as ExistingPrediction[];
    const optionsByScore = new Map<string, {
      predicted_home_score: number;
      predicted_away_score: number;
      group_names: string[];
    }>();

    optionsByScore.set(scoreKey(predictedHomeScore, predictedAwayScore), {
      predicted_home_score: predictedHomeScore,
      predicted_away_score: predictedAwayScore,
      group_names: [groupNameById.get(groupId) ?? "Grupo atual"],
    });

    for (const prediction of existing) {
      const key = scoreKey(prediction.predicted_home_score, prediction.predicted_away_score);
      const option = optionsByScore.get(key) ?? {
        predicted_home_score: prediction.predicted_home_score,
        predicted_away_score: prediction.predicted_away_score,
        group_names: [],
      };
      option.group_names.push(groupNameById.get(prediction.group_id) ?? "Grupo");
      optionsByScore.set(key, option);
    }

    const conflictOptions = Array.from(optionsByScore.values()).map((option) => ({
      ...option,
      group_names: Array.from(new Set(option.group_names)),
    }));

    if (conflictOptions.length > 1 && !resolveConflict) {
      return json(200, { conflict: true, options: conflictOptions, total: activeGroups.length });
    }

    const lockChecks = await Promise.all(
      groupIds.map(async (targetGroupId) => ({
        groupId: targetGroupId,
        lockAt: await requirePredictionLockAt(admin, targetGroupId, matchId),
      })),
    );
    const locked = lockChecks.filter((check) => check.lockAt <= Date.now());
    if (locked.length > 0) {
      const names = locked.map((check) => groupNameById.get(check.groupId) ?? "Grupo").join(", ");
      throw new HttpError(423, `Palpite bloqueado em: ${names}`);
    }

    let saved = groupIds.length;
    if (goalSelections) {
      const results = await Promise.all(
        groupIds.map((targetGroupId) => admin.rpc("save_prediction_with_goal_selections", {
          p_group_id: targetGroupId,
          p_user_id: user.id,
          p_match_id: matchId,
          p_predicted_home_score: predictedHomeScore,
          p_predicted_away_score: predictedAwayScore,
          p_goal_selections: goalSelections,
        })),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      saved = results.length;
    } else {
      const rows = groupIds.map((targetGroupId) => ({
        group_id: targetGroupId,
        user_id: user.id,
        match_id: matchId,
        predicted_home_score: predictedHomeScore,
        predicted_away_score: predictedAwayScore,
      }));
      const { data: predictions, error } = await admin
        .from("predictions")
        .upsert(rows, { onConflict: "group_id,user_id,match_id" })
        .select("id");
      if (error) throw error;
      saved = predictions?.length ?? rows.length;
    }

    return json(200, {
      saved,
      total: activeGroups.length,
      prediction: {
        match_id: matchId,
        predicted_home_score: predictedHomeScore,
        predicted_away_score: predictedAwayScore,
      },
    });
  } catch (error) {
    console.error("save-prediction-all-groups error", error);
    return handleError(error);
  }
});
