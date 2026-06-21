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

type Selection = {
  player_id: string;
  slot_index: number;
  selected_role: "gk" | "df" | "mf" | "fw";
};

const formations = new Set(["4-3-3", "4-4-2", "3-5-2", "free-11"]);
const roles = new Set(["gk", "df", "mf", "fw"]);

function parseSelections(value: unknown): Selection[] {
  if (!Array.isArray(value) || value.length !== 11) {
    throw new HttpError(400, "Exactly 11 players are required");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new HttpError(400, "Invalid player selection");
    const row = item as Record<string, unknown>;
    const playerId = requireString(row.player_id, `selections[${index}].player_id`);
    const slotIndex = row.slot_index;
    const role = row.selected_role;
    if (!Number.isInteger(slotIndex) || Number(slotIndex) < 0 || Number(slotIndex) > 10) {
      throw new HttpError(400, "Invalid field slot");
    }
    if (typeof role !== "string" || !roles.has(role)) {
      throw new HttpError(400, "Invalid player position");
    }
    return { player_id: playerId, slot_index: Number(slotIndex), selected_role: role as Selection["selected_role"] };
  });
}

function statusForDatabaseError(message: string) {
  if (message.includes("closed")) return 423;
  if (message.includes("not an active") || message.includes("not eligible") || message.includes("not selected")) return 403;
  return 400;
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
    const windowId = requireString(body.window_id, "window_id");
    const formation = requireString(body.formation, "formation");
    const selections = parseSelections(body.selections);
    const applyToAllGroups = body.apply_to_all_groups === true;

    if (!formations.has(formation)) throw new HttpError(400, "Invalid formation");
    await ensureActiveMember(admin, groupId, user.id);

    const { data: sourceWindow, error: sourceError } = await admin
      .from("best_player_voting_windows")
      .select("id, group_id, competition_id, kind, vote_date, status")
      .eq("id", windowId)
      .eq("group_id", groupId)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!sourceWindow) throw new HttpError(404, "Voting window not found");

    let targets = [{ id: sourceWindow.id, group_id: sourceWindow.group_id }];
    if (applyToAllGroups && sourceWindow.kind === "daily") {
      const { data: memberships, error: membershipsError } = await admin
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (membershipsError) throw membershipsError;
      const groupIds = (memberships ?? []).map((row) => row.group_id);
      if (groupIds.length > 0) {
        const { data: compatible, error: compatibleError } = await admin
          .from("best_player_voting_windows")
          .select("id, group_id")
          .eq("kind", "daily")
          .eq("competition_id", sourceWindow.competition_id)
          .eq("vote_date", sourceWindow.vote_date)
          .eq("status", "open")
          .in("group_id", groupIds);
        if (compatibleError) throw compatibleError;
        targets = compatible ?? targets;
      }
    }

    const { data: groups } = await admin
      .from("groups")
      .select("id, name")
      .in("id", targets.map((target) => target.group_id));
    const names = new Map((groups ?? []).map((group) => [group.id, group.name]));
    const saved: Array<{ group_id: string; group_name: string }> = [];
    const skipped: Array<{ group_id: string; group_name: string; reason: string }> = [];

    for (const target of targets) {
      const { error } = await admin.rpc("save_best_player_ballot_internal", {
        p_window_id: target.id,
        p_user_id: user.id,
        p_formation: formation,
        p_selections: selections,
      });
      const groupName = names.get(target.group_id) ?? "Grupo";
      if (error) skipped.push({ group_id: target.group_id, group_name: groupName, reason: error.message });
      else saved.push({ group_id: target.group_id, group_name: groupName });
    }

    if (saved.length === 0) {
      const message = skipped[0]?.reason ?? "Vote could not be saved";
      throw new HttpError(statusForDatabaseError(message), message);
    }

    return json(200, { saved, skipped });
  } catch (error) {
    return handleError(error);
  }
});
