export const ADMIN_EMAIL = "josualisson17@gmail.com";

export function isAdminEmail(email?: string | null) {
  return (email ?? "").toLowerCase() === ADMIN_EMAIL;
}
