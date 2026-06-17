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

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const body = await readJson(req);
    const code = requireString(body.code, "code").toUpperCase();

    const { data: invite, error: inviteError } = await admin
      .from("group_invites")
      .select("id, group_id, role, status, max_uses, uses_count, expires_at")
      .eq("code", code)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) throw new HttpError(404, "Invite not found");
    if (invite.status !== "active") throw new HttpError(400, "Invite is not active");
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new HttpError(400, "Invite has expired");
    }
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) {
      throw new HttpError(400, "Invite usage limit reached");
    }

    const { data: existing, error: existingError } = await admin
      .from("group_members")
      .select("id, status")
      .eq("group_id", invite.group_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "blocked") throw new HttpError(403, "User is blocked from this group");

    if (existing) {
      const { data, error } = await admin
        .from("group_members")
        .update({
          status: "active",
          role: invite.role,
          joined_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, group_id, user_id, role, status")
        .single();
      if (error) throw error;

      return json(200, { membership: data });
    }

    const { data: membership, error: memberError } = await admin
      .from("group_members")
      .insert({
        group_id: invite.group_id,
        user_id: user.id,
        role: invite.role,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .select("id, group_id, user_id, role, status")
      .single();
    if (memberError) throw memberError;

    await admin
      .from("group_invites")
      .update({ uses_count: invite.uses_count + 1 })
      .eq("id", invite.id);

    return json(201, { membership });
  } catch (error) {
    return handleError(error);
  }
});

