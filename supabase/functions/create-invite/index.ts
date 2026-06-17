import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  ensureActiveMember,
  handleError,
  handleOptions,
  json,
  optionalString,
  randomCode,
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

    const role = optionalString(body.role) ?? "member";
    if (!["admin", "member"].includes(role)) {
      return json(400, { error: "role must be admin or member" });
    }

    const maxUses = typeof body.max_uses === "number" && Number.isInteger(body.max_uses)
      ? body.max_uses
      : null;
    const expiresAt = optionalString(body.expires_at);
    const code = optionalString(body.code)?.toUpperCase() ?? randomCode("PAL-");

    const { data, error } = await admin
      .from("group_invites")
      .insert({
        group_id: groupId,
        code,
        role,
        invited_by: user.id,
        max_uses: maxUses,
        expires_at: expiresAt,
      })
      .select("id, group_id, code, role, max_uses, uses_count, expires_at, status")
      .single();
    if (error) throw error;

    return json(201, { invite: data });
  } catch (error) {
    return handleError(error);
  }
});

