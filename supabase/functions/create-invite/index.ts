import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  ensureActiveMember,
  handleError,
  handleOptions,
  HttpError,
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
    const member = await ensureActiveMember(admin, groupId, user.id);

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("allow_member_invites")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group) throw new HttpError(404, "Group not found");

    const canInvite =
      ["owner", "admin"].includes(member.role) ||
      (member.role === "member" && group.allow_member_invites === true);

    if (!canInvite) {
      throw new HttpError(403, "Only group admins can invite members");
    }

    const role = optionalString(body.role) ?? "member";
    if (member.role === "member" && role !== "member") {
      throw new HttpError(403, "Members can only invite regular members");
    }
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
