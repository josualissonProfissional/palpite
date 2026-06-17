import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  handleError,
  handleOptions,
  json,
  optionalString,
  randomCode,
  readJson,
  requireString,
  requireUser,
  slugify,
} from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const body = await readJson(req);

    const name = requireString(body.name, "name");
    const requestedSlug = optionalString(body.slug);
    const baseSlug = requestedSlug ? slugify(requestedSlug) : slugify(name);
    if (!baseSlug) throw new Error("Could not generate a valid slug");

    const description = optionalString(body.description);
    let competitionId = optionalString(body.competition_id);

    if (!competitionId) {
      const { data, error } = await admin
        .from("competitions")
        .select("id")
        .eq("name", "FIFA World Cup")
        .eq("season", "2026")
        .maybeSingle();
      if (error) throw error;
      competitionId = data?.id ?? null;
    }

    const inviteCode = randomCode("PAL-");

    let group: { id: string; name: string; slug: string; invite_code: string } | null = null;
    let groupError: unknown = null;
    const maxSlugAttempts = requestedSlug ? 1 : 6;

    for (let attempt = 0; attempt < maxSlugAttempts; attempt += 1) {
      const slug =
        attempt === 0
          ? baseSlug
          : `${baseSlug}-${randomCode().toLowerCase().slice(0, 6)}`;
      const { data, error } = await admin
        .from("groups")
        .insert({
          name,
          slug,
          description,
          created_by: user.id,
          competition_id: competitionId,
          invite_code: inviteCode,
        })
        .select("id, name, slug, invite_code")
        .single();

      if (!error) {
        group = data;
        groupError = null;
        break;
      }

      groupError = error;
      if (requestedSlug || error.code !== "23505") {
        break;
      }
    }

    if (!group) throw groupError;

    const { error: memberError } = await admin.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    if (memberError) throw memberError;

    const { error: rulesError } = await admin.from("scoring_rules").insert({ group_id: group.id });
    if (rulesError) throw rulesError;

    const { error: inviteError } = await admin.from("group_invites").insert({
      group_id: group.id,
      code: inviteCode,
      role: "member",
      invited_by: user.id,
    });
    if (inviteError) throw inviteError;

    return json(201, { group });
  } catch (error) {
    return handleError(error);
  }
});
