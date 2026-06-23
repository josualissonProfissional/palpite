import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "player-photos";
const BATCH_SIZE = 15; // imagens por execução (conservador)
const REQUEST_TIMEOUT_MS = 12_000;

type PlayerRow = {
  id: string;
  photo_url: string | null;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requireInternalSecret(req: Request) {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected) return "INTERNAL_FUNCTION_SECRET is not configured";
  if (req.headers.get("x-internal-secret") !== expected) return "Invalid internal secret";
  return null;
}

function storageUrl(projectRef: string, playerId: string) {
  return `https://${projectRef}.supabase.co/storage/v1/object/public/${BUCKET}/${playerId}.png`;
}

async function downloadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authError = requireInternalSecret(req);
  if (authError) {
    return json(authError.includes("configured") ? 500 : 401, { error: authError });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Supabase service credentials are not configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
  });

  // Modo diagnóstico
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ok */ }
  if (body.action === "stats") {
    const [{ count: total }, { count: withPhoto }, { count: fromApiSports }, { count: fromStorage }] = await Promise.all([
      admin.from("players").select("id", { count: "exact", head: true }),
      admin.from("players").select("id", { count: "exact", head: true }).not("photo_url", "is", null),
      admin.from("players").select("id", { count: "exact", head: true }).eq("photo_source", "api-sports").not("photo_url", "is", null),
      admin.from("players").select("id", { count: "exact", head: true }).eq("photo_source", "supabase-storage"),
    ]);
    return json(200, {
      total_players: total ?? 0,
      with_photo: withPhoto ?? 0,
      still_api_sports: fromApiSports ?? 0,
      cached_storage: fromStorage ?? 0,
    });
  }

  if (body.action === "teams_status") {
    const { data: teams, error } = await admin
      .from("teams")
      .select("name, api_sports_team_id, api_sports_players_synced_at, api_sports_players_sync_attempts, api_sports_players_last_error")
      .order("name");
    if (error) return json(500, { error: error.message });
    const synced = (teams ?? []).filter((t: any) => t.api_sports_players_synced_at);
    const pending = (teams ?? []).filter((t: any) => !t.api_sports_players_synced_at && t.api_sports_team_id);
    const unmapped = (teams ?? []).filter((t: any) => !t.api_sports_players_synced_at && !t.api_sports_team_id);
    return json(200, {
      total: (teams ?? []).length,
      synced: synced.length,
      pending_with_id: pending.length,
      unmapped: unmapped.length,
      errors: unmapped.filter((t: any) => t.api_sports_players_last_error).map((t: any) => ({
        name: t.name,
        attempts: t.api_sports_players_sync_attempts,
        error: String(t.api_sports_players_last_error ?? "").slice(0, 100),
      })),
    });
  }

  // Pega jogadores que têm photo_url da api-sports mas ainda não estão cacheados
  // Identificamos pelo source e por já ter URL que não é do nosso storage
  const { data: players, error: queryError } = await admin
    .from("players")
    .select("id, photo_url")
    .eq("photo_source", "api-sports")
    .not("photo_url", "is", null)
    .not("photo_url", "ilike", `%${BUCKET}%`)
    .order("photo_synced_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (queryError) {
    return json(500, { error: queryError.message });
  }

  const rows = (players ?? []) as PlayerRow[];
  if (rows.length === 0) {
    return json(200, { status: "all_cached", cached: 0, remaining: 0 });
  }

  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
  let cached = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const player of rows) {
    if (!player.photo_url) continue;

    try {
      const imageData = await downloadImage(player.photo_url);
      if (!imageData) {
        failed += 1;
        continue;
      }

      const storagePath = `${player.id}.png`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(storagePath, imageData, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "31536000", // 1 ano de cache
        });

      if (uploadError) {
        failed += 1;
        errors.push(`${player.id}: ${uploadError.message}`);
        continue;
      }

      const newUrl = storageUrl(projectRef, player.id);
      const { error: updateError } = await admin
        .from("players")
        .update({ photo_url: newUrl, photo_source: "supabase-storage" })
        .eq("id", player.id);

      if (updateError) {
        failed += 1;
        errors.push(`${player.id}: update ${updateError.message}`);
        continue;
      }

      cached += 1;
    } catch (err) {
      failed += 1;
      errors.push(`${player.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Conta quantos ainda faltam
  const { count } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("photo_source", "api-sports")
    .not("photo_url", "is", null)
    .not("photo_url", "ilike", `%${BUCKET}%`);

  return json(200, {
    status: "ok",
    cached,
    failed,
    remaining: count ?? 0,
    ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
  });
});
