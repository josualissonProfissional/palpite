import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  ensureActiveMember,
  handleError,
  handleOptions,
  json,
  readJson,
  requireString,
  requireUser,
} from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const body = await readJson(req);
    const groupId = requireString(body.group_id, "group_id");

    await ensureActiveMember(admin, groupId, user.id, ["owner", "admin"]);

    const [predictionResult, bestPlayersResult] = await Promise.all([
      admin.from("prediction_scores").delete({ count: "exact" }).eq("group_id", groupId),
      admin.from("best_player_scores").delete({ count: "exact" }).eq("group_id", groupId),
    ]);
    if (predictionResult.error) throw predictionResult.error;
    if (bestPlayersResult.error) throw bestPlayersResult.error;
    const deletedCount = (predictionResult.count ?? 0) + (bestPlayersResult.count ?? 0);

    await admin.from("audit_logs").insert({
      user_id: user.id,
      group_id: groupId,
      action: "reset_ranking",
      entity_type: "prediction_scores",
      entity_id: groupId,
      metadata: {
        deleted_count: deletedCount,
        prediction_scores: predictionResult.count ?? 0,
        best_player_scores: bestPlayersResult.count ?? 0,
      },
    });

    return json(200, { status: "success", deleted_count: deletedCount });
  } catch (error) {
    return handleError(error);
  }
});
