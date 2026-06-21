import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  ensureActiveMember,
  handleError,
  handleOptions,
  HttpError,
  json,
  optionalString,
  readJson,
  requireString,
  requireUser,
} from "../_shared/backend.ts";

const durations = new Set([720, 1440, 2880]);

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const body = await readJson(req);
    const groupId = requireString(body.group_id, "group_id");
    const roundName = requireString(body.round_name, "round_name");
    const openMode = requireString(body.open_mode, "open_mode");
    const durationMinutes = Number(body.duration_minutes);
    const scheduledOpenAt = optionalString(body.scheduled_open_at);

    if (openMode !== "automatic" && openMode !== "scheduled") {
      throw new HttpError(400, "open_mode must be automatic or scheduled");
    }
    if (!durations.has(durationMinutes)) {
      throw new HttpError(400, "duration_minutes must be 720, 1440 or 2880");
    }
    if (openMode === "scheduled" && (!scheduledOpenAt || Number.isNaN(Date.parse(scheduledOpenAt)))) {
      throw new HttpError(400, "A valid scheduled_open_at is required");
    }

    await ensureActiveMember(admin, groupId, user.id, ["owner", "admin"]);
    const [{ data: group, error: groupError }, { data: rules, error: rulesError }] = await Promise.all([
      admin.from("groups").select("competition_id").eq("id", groupId).maybeSingle(),
      admin.from("best_player_rules").select("*").eq("group_id", groupId).maybeSingle(),
    ]);
    if (groupError) throw groupError;
    if (rulesError) throw rulesError;
    if (!group?.competition_id || !rules) throw new HttpError(404, "Group rules were not found");
    if (!rules.round_team_voting_enabled) throw new HttpError(409, "Round team voting is disabled");

    const { data: matches, error: matchesError } = await admin
      .from("matches")
      .select("id, stage")
      .eq("competition_id", group.competition_id)
      .eq("round_name", roundName);
    if (matchesError) throw matchesError;
    if (!matches?.length) throw new HttpError(404, "Round was not found");

    const { data: existing, error: existingError } = await admin
      .from("best_player_voting_windows")
      .select("id, status")
      .eq("group_id", groupId)
      .eq("competition_id", group.competition_id)
      .eq("kind", "round")
      .eq("round_name", roundName)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing && !["scheduled", "cancelled"].includes(existing.status)) {
      throw new HttpError(409, "This voting window can no longer be changed");
    }

    const payload = {
      group_id: groupId,
      competition_id: group.competition_id,
      kind: "round",
      round_name: roundName,
      stage: matches[0].stage,
      open_mode: openMode,
      scheduled_open_at: openMode === "scheduled" ? scheduledOpenAt : null,
      duration_minutes: durationMinutes,
      status: "scheduled",
      points_per_hit_snapshot: rules.points_per_average_hit,
      allow_edit_snapshot: rules.allow_round_vote_edit_before_close,
      respect_position_snapshot: rules.respect_player_position,
      minimum_ballots: 2,
    };

    const query = existing
      ? admin.from("best_player_voting_windows").update(payload).eq("id", existing.id)
      : admin.from("best_player_voting_windows").insert(payload);
    const { data: window, error: saveError } = await query.select("*").single();
    if (saveError) throw saveError;

    const { error: matchLinkError } = await admin.from("best_player_window_matches").upsert(
      matches.map((match) => ({ window_id: window.id, match_id: match.id })),
      { onConflict: "window_id,match_id" },
    );
    if (matchLinkError) throw matchLinkError;

    await admin.rpc("process_best_player_windows");
    return json(200, { window });
  } catch (error) {
    return handleError(error);
  }
});
