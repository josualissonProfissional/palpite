import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient<any, any, any>;

export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
};

export function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return null;
}

export function createAdminClient(): AnySupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
  });
}

export function createUserClient(req: Request): AnySupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("authorization") ?? "";

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase public credentials are not configured");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "palpite" },
    global: {
      headers: { authorization },
    },
  });
}

export async function requireUser(req: Request, admin: AnySupabaseClient): Promise<User> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new HttpError(401, "Missing user token");
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "Invalid user token");
  }

  return data.user;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return json(error.status, { error: error.message });
  }

  if (error instanceof Error) {
    return json(500, { error: error.message });
  }

  return json(500, { error: String(error) });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  return await req.json().catch(() => ({}));
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required`);
  }

  return value.trim();
}

export function optionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function randomCode(prefix = ""): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 10);
  return `${prefix}${value}`.toUpperCase();
}

export async function ensureActiveMember(
  admin: AnySupabaseClient,
  groupId: string,
  userId: string,
  roles?: string[],
) {
  let query = admin
    .from("group_members")
    .select("id, role, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(403, "User is not an active member of this group");
  }

  if (roles && !roles.includes(data.role)) {
    throw new HttpError(403, "User does not have permission for this action");
  }

  return data;
}
