/**
 * Auth.js uses `new URL(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL)`.
 * Values like `royal-orange.goure.ca` throw ERR_INVALID_URL; require `https://...`.
 */
export function normalizeAuthEnvUrls(): void {
  for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
    const raw = process.env[key];
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t || /^https?:\/\//i.test(t)) continue;
    process.env[key] = `https://${t.replace(/^\/+/, "")}`;
  }
}
