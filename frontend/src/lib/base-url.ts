/**
 * Resolve a URL base correta em qualquer ambiente (localhost, preview, producao).
 *
 * Ordem de prioridade:
 * 1. NEXT_PUBLIC_SITE_URL — dominio canonico configurado manualmente.
 * 2. window.location.origin — o dominio que o navegador esta acessando agora.
 * 3. NEXT_PUBLIC_VERCEL_URL — dominio automatico de deploys na Vercel.
 * 4. http://localhost:3000 — ultimo recurso no servidor durante o dev.
 */
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
