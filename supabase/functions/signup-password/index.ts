import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  handleError,
  handleOptions,
  HttpError,
  json,
  optionalString,
  readJson,
  requireString,
} from "../_shared/backend.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const admin = createAdminClient();
    const body = await readJson(req);
    const email = requireString(body.email, "email").toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = optionalString(body.full_name);

    if (!password) {
      throw new HttpError(400, "password is required");
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (error) {
      const message = error.message.toLowerCase().includes("already")
        ? "Este email ja esta cadastrado. Entre ou use Esqueci minha senha."
        : error.message;
      throw new HttpError(error.status ?? 400, message);
    }

    return json(201, { user: { id: data.user?.id, email: data.user?.email } });
  } catch (error) {
    return handleError(error);
  }
});
