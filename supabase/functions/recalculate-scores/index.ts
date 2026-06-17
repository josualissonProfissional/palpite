import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requireInternalSecret(req: Request) {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected) {
    return "INTERNAL_FUNCTION_SECRET is not configured";
  }

  const received = req.headers.get("x-internal-secret");
  if (received !== expected) {
    return "Invalid internal secret";
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authError = requireInternalSecret(req);
  if (authError) {
    return json(authError.includes("configured") ? 500 : 401, { error: authError });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Supabase service credentials are not configured" });
  }

  const body = await req.json().catch(() => ({}));
  const matchId = body.match_id as string | undefined;
  const groupId = (body.group_id as string | undefined) ?? null;

  if (!matchId) {
    return json(400, { error: "match_id is required" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
  });

  const { data, error } = await admin.rpc("recalculate_match_scores", {
    p_match_id: matchId,
    p_group_id: groupId,
  });

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, { status: "success", recalculated: data });
});
