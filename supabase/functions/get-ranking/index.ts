import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  createUserClient,
  ensureActiveMember,
  handleError,
  handleOptions,
  json,
  optionalString,
  readJson,
  requireString,
  requireUser,
} from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const url = new URL(req.url);
    const body = req.method === "POST" ? await readJson(req) : {};

    const groupId = requireString(body.group_id ?? url.searchParams.get("group_id"), "group_id");
    await ensureActiveMember(admin, groupId, user.id);

    const userClient = createUserClient(req);
    const { data, error } = await userClient.rpc("get_group_ranking", {
      p_group_id: groupId,
      p_round_name: optionalString(body.round_name ?? url.searchParams.get("round_name")),
      p_match_date: optionalString(body.match_date ?? url.searchParams.get("match_date")),
      p_stage: optionalString(body.stage ?? url.searchParams.get("stage")),
      p_from: optionalString(body.from ?? url.searchParams.get("from")),
      p_to: optionalString(body.to ?? url.searchParams.get("to")),
    });
    if (error) throw error;

    return json(200, { ranking: data });
  } catch (error) {
    return handleError(error);
  }
});

