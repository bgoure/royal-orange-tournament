import { headers } from "next/headers";

/**
 * Canonical browser origin for the current request (Vercel sets x-forwarded-*).
 * Use for absolute same-origin links when env-based auth URLs might be misconfigured.
 */
export async function getRequestPublicOrigin(): Promise<string> {
  const h = await headers();
  const rawHost = h.get("x-forwarded-host") ?? h.get("host");
  const host = rawHost?.split(",")[0]?.trim();
  if (!host) return "";
  const rawProto = h.get("x-forwarded-proto");
  const proto =
    rawProto?.split(",")[0]?.trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
