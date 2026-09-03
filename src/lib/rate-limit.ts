import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Database-backed fixed-window rate limiting. Server-side only — it touches Prisma and
 * `node:crypto`, so never import it from a Client Component.
 *
 * Serverless instances don't share memory, so an in-process Map would reset on every cold
 * start and never see traffic handled by a sibling instance. Counters live in
 * `RateLimitBucket`, keyed by scope + subject, and expire with their window.
 */

export type RateLimitResult = {
  ok: boolean;
  /** Requests left in the current window (0 once denied). */
  remaining: number;
  /** Seconds until the window resets — surface as `Retry-After`. */
  retryAfterSeconds: number;
};

export type RateLimitRule = {
  /** Namespace for the counter, e.g. `feedback:ip`. */
  scope: string;
  /** Subject within the scope (IP, tournament id, payload hash). Hashed before storage. */
  subject: string;
  limit: number;
  windowMs: number;
};

/** Retention: expired buckets are swept opportunistically, this far past their window. */
const CLEANUP_GRACE_MS = 60 * 60 * 1000;
const CLEANUP_SAMPLE_RATE = 0.02;

/** Subjects can be IPs or free text, so hash them: no raw PII in the table. */
export function hashSubject(subject: string): string {
  return createHash("sha256").update(subject).digest("hex").slice(0, 32);
}

function bucketKey(rule: RateLimitRule): string {
  return `${rule.scope}:${hashSubject(rule.subject)}`;
}

function allowed(remaining: number, retryAfterSeconds: number): RateLimitResult {
  return { ok: true, remaining, retryAfterSeconds };
}

/**
 * Counts one hit against `rule`. Fails open: if the database is unreachable the request is
 * allowed, because dropping legitimate tournament traffic is worse than a missed limit.
 */
export async function consumeRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  const key = bucketKey(rule);
  const now = new Date();
  const retryAfterSeconds = Math.ceil(rule.windowMs / 1000);

  try {
    const live = await prisma.rateLimitBucket.updateMany({
      where: { key, expiresAt: { gt: now } },
      data: { count: { increment: 1 } },
    });

    if (live.count === 0) {
      // No window, or the previous one lapsed — start a fresh one.
      const expiresAt = new Date(now.getTime() + rule.windowMs);
      await prisma.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now, expiresAt },
        update: { count: 1, windowStart: now, expiresAt },
      });
      void sweepExpiredBuckets();
      return allowed(Math.max(0, rule.limit - 1), retryAfterSeconds);
    }

    const bucket = await prisma.rateLimitBucket.findUnique({
      where: { key },
      select: { count: true, expiresAt: true },
    });
    const count = bucket?.count ?? 1;
    const resetInSeconds = bucket
      ? Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000))
      : retryAfterSeconds;

    if (count > rule.limit) {
      return { ok: false, remaining: 0, retryAfterSeconds: resetInSeconds };
    }
    return allowed(Math.max(0, rule.limit - count), resetInSeconds);
  } catch (e) {
    console.warn("[rate-limit] check failed, allowing request:", e);
    return allowed(rule.limit, retryAfterSeconds);
  }
}

/**
 * True the first time this key is seen within `windowMs`, false for repeats — used to
 * suppress duplicate submissions (double-tapped forms, retried server actions).
 */
export async function isFirstOccurrence(rule: Omit<RateLimitRule, "limit">): Promise<boolean> {
  const result = await consumeRateLimit({ ...rule, limit: 1 });
  return result.ok;
}

/** Deletes lapsed buckets. Sampled so it costs roughly one delete per 50 fresh windows. */
export async function sweepExpiredBuckets(force = false): Promise<number> {
  if (!force && Math.random() > CLEANUP_SAMPLE_RATE) return 0;
  try {
    const cutoff = new Date(Date.now() - CLEANUP_GRACE_MS);
    const { count } = await prisma.rateLimitBucket.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return count;
  } catch (e) {
    console.warn("[rate-limit] cleanup failed:", e);
    return 0;
  }
}

/**
 * Best-effort client IP from proxy headers. Vercel sets `x-forwarded-for`; the left-most
 * entry is the client. Falls back to a constant so a missing header shares one bucket
 * rather than bypassing limits entirely.
 */
export function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || h.get("cf-connecting-ip")?.trim() || "unknown";
}
