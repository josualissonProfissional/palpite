import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "player-photos";
const PLAYERS_PER_RUN = 20;
const WP_REST = "https://en.wikipedia.org/api/rest_v1";
const WP_API = "https://en.wikipedia.org/w/api.php";
const UA = "PalpiteApp/1.0 (palpite.app; contact@palpite.app)";

type DbPlayer = { id: string; name: string; team_id: string; team_name: string | null };

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

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/ /g, "_");
}

async function wpPageSummary(title: string): Promise<string | null> {
  const url = `${WP_REST}/page/summary/${encodeURIComponent(title)}?redirect=true`;
  const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  // Prefer original size, fallback to thumbnail
  return data.originalimage?.source || data.thumbnail?.source || null;
}

async function wpSearch(query: string): Promise<string | null> {
  const url = `${WP_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`;
  const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  // data[1] is titles array, data[3] is URLs array
  const titles = data[1] ?? [];
  const urls = data[3] ?? [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    // Filter out non-player pages
    if (/^(List|Category|Template|Portal|Wikipedia|File|Draft|202[0-9]|19[0-9])/.test(title)) continue;
    // Try to get image from page summary
    const img = await wpPageSummary(title);
    if (img) return img;
  }
  return null;
}

async function downloadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12_000) });
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authError = requireInternalSecret(req);
  if (authError) return json(authError.includes("configured") ? 500 : 401, { error: authError });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
  });
  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];

  // Pega jogadores sem foto, priorizando os ainda não tentados
  const { data: players, error } = await admin
    .from("players")
    .select("id, name, team_id, team:team_id(name)")
    .is("photo_url", null)
    .order("photo_synced_at", { ascending: true, nullsFirst: true })
    .limit(PLAYERS_PER_RUN);

  if (error) return json(500, { error: error.message });

  const rows = (players ?? []) as unknown as { id: string; name: string; team_id: string; team: { name: string } | null }[];
  if (rows.length === 0) {
    const { count } = await admin.from("players").select("id", { count: "exact", head: true }).is("photo_url", null);
    return json(200, { status: "done", synced: 0, remaining: count ?? 0 });
  }

  let synced = 0;
  const errors: string[] = [];

  for (const player of rows) {
    try {
      const name = player.name;
      const teamName = player.team?.name ?? "";

      // Strategy 1: exact name
      let imgUrl = await wpPageSummary(name.replace(/ /g, "_"));

      // Strategy 2: slugified name
      if (!imgUrl) {
        imgUrl = await wpPageSummary(slugify(name));
      }

      // Strategy 3: search with name + football
      if (!imgUrl) {
        imgUrl = await wpSearch(`${name} footballer`);
      }

      // Strategy 4: search with name + team
      if (!imgUrl && teamName) {
        imgUrl = await wpSearch(`${name} ${teamName}`);
      }

      if (!imgUrl) {
        await admin.from("players").update({ photo_synced_at: new Date().toISOString() }).eq("id", player.id);
        continue;
      }

      const imageData = await downloadImage(imgUrl);
      if (!imageData) {
        await admin.from("players").update({ photo_synced_at: new Date().toISOString() }).eq("id", player.id);
        continue;
      }

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(`${player.id}.png`, imageData, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "31536000",
        });
      if (uploadError) {
        errors.push(`${name}: upload ${uploadError.message}`);
        continue;
      }

      const newUrl = storageUrl(projectRef, player.id);
      await admin.from("players").update({
        photo_url: newUrl,
        photo_source: "wikipedia",
        photo_synced_at: new Date().toISOString(),
      }).eq("id", player.id);

      synced += 1;
    } catch (err) {
      await admin.from("players").update({ photo_synced_at: new Date().toISOString() }).eq("id", player.id).catch(() => {});
      errors.push(`${player.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { count: remaining } = await admin.from("players").select("id", { count: "exact", head: true }).is("photo_url", null);
  return json(200, { status: "ok", synced, remaining: remaining ?? 0, ...(errors.length > 0 ? { errors: errors.slice(0, 5) } : {}) });
});
