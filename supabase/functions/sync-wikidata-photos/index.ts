import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "player-photos";
const PLAYERS_PER_RUN = 25;
const WD_SEARCH = "https://www.wikidata.org/w/api.php";
const WD_ENTITY = "https://www.wikidata.org/wiki/Special:EntityData";
const COMMONS_FILE = "https://commons.wikimedia.org/wiki/Special:FilePath";
const UA = "PalpiteApp/1.0 (palpite.app)";

type DbPlayer = {
  id: string;
  name: string;
  team_id: string;
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

async function wikidataSearch(name: string): Promise<{ id: string; label: string } | null> {
  const url = `${WD_SEARCH}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&type=item&limit=5`;
  const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  const results = data.search ?? [];
  // Prioritize football players
  const football = results.filter((r: any) =>
    /football|soccer|midfielder|forward|defender|goalkeeper|winger|striker/i.test(r.description ?? "")
  );
  const best = football[0] ?? results[0];
  return best ? { id: best.id, label: best.label } : null;
}

async function wikidataImage(wdId: string): Promise<string | null> {
  const url = `${WD_ENTITY}/${wdId}.json`;
  const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  const entity = data.entities?.[wdId];
  const p18 = entity?.claims?.P18;
  if (!p18?.length) return null;
  const filename = p18[0].mainsnak.datavalue.value;
  return `${COMMONS_FILE}/${encodeURIComponent(filename.replace(/ /g, "_"))}?width=200`;
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
  if (authError) {
    return json(authError.includes("configured") ? 500 : 401, { error: authError });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
  });
  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];

  // Pega jogadores sem foto
  const { data: players, error } = await admin
    .from("players")
    .select("id, name, team_id")
    .is("photo_url", null)
    .order("photo_synced_at", { ascending: true, nullsFirst: true })
    .limit(PLAYERS_PER_RUN);

  if (error) return json(500, { error: error.message });
  const rows = (players ?? []) as DbPlayer[];
  if (rows.length === 0) {
    // Conta restantes
    const { count } = await admin.from("players").select("id", { count: "exact", head: true }).is("photo_url", null);
    return json(200, { status: "done", synced: 0, remaining: count ?? 0 });
  }

  let synced = 0;
  const errors: string[] = [];

  for (const player of rows) {
    try {
      const wd = await wikidataSearch(player.name);
      if (!wd) continue;

      const imgUrl = await wikidataImage(wd.id);
      if (!imgUrl) {
        // Marca como tentado pra não reprocessar
        await admin.from("players").update({
          photo_synced_at: new Date().toISOString(),
        }).eq("id", player.id);
        continue;
      }

      const imageData = await downloadImage(imgUrl);
      if (!imageData) {
        await admin.from("players").update({
          photo_synced_at: new Date().toISOString(),
        }).eq("id", player.id);
        continue;
      }

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(`${player.id}.png`, imageData, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "31536000",
        });
      if (uploadError) { errors.push(`${player.name}: upload ${uploadError.message}`); continue; }

      const newUrl = storageUrl(projectRef, player.id);
      await admin.from("players").update({
        photo_url: newUrl,
        photo_source: "wikidata",
        photo_synced_at: new Date().toISOString(),
      }).eq("id", player.id);

      synced += 1;
    } catch (err) {
      await admin.from("players").update({
        photo_synced_at: new Date().toISOString(),
      }).eq("id", player.id).catch(() => {});
      errors.push(`${player.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { count: remaining } = await admin.from("players").select("id", { count: "exact", head: true }).is("photo_url", null);
  return json(200, { status: "ok", synced, remaining: remaining ?? 0, ...(errors.length > 0 ? { errors: errors.slice(0, 5) } : {}) });
});
