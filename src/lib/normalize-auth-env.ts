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

/**
 * On Vercel preview/production, warn once if AUTH_URL host does not match the deployment host.
 * Does not throw — misconfig is operational; see AGENTS.md checklist.
 */
export function warnIfAuthUrlHostMismatch(): void {
  if (process.env.VERCEL !== "1") return;
  const authRaw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  const vercelHost = process.env.VERCEL_URL?.replace(/^https?:\/\//i, "").split("/")[0];
  if (!authRaw || !vercelHost) return;
  try {
    const authHost = new URL(authRaw).host;
    if (authHost !== vercelHost) {
      console.warn(
        `[auth] AUTH_URL/NEXTAUTH_URL host "${authHost}" does not match VERCEL_URL host "${vercelHost}". OAuth redirects may land on the wrong origin. See AGENTS.md Staging vs Production Auth checklist.`,
      );
    }
  } catch {
    /* ignore invalid URL — Auth.js will fail elsewhere */
  }
}
