import { Resend } from "resend";

const DEFAULT_BATCH = 50;

/** Send one personalized batch (Resend batch API); chunks if needed. */
export async function sendAnnouncementBulk(opts: {
  recipients: string[];
  from: string;
  subject: string;
  html: string;
  text: string;
  /** Prefix for idempotency keys (e.g. announcement id). */
  idempotencyKeyPrefix: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const unique = [...new Set(opts.recipients.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) {
    return { ok: false, error: "No recipient addresses" };
  }

  const resend = new Resend(apiKey);

  for (let i = 0; i < unique.length; i += DEFAULT_BATCH) {
    const chunk = unique.slice(i, i + DEFAULT_BATCH);
    const payload = chunk.map((to) => ({
      from: opts.from,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }));

    const { error } = await resend.batch.send(payload, {
      idempotencyKey: `${opts.idempotencyKeyPrefix}:part:${i}`,
    });

    if (error) {
      const msg =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Resend batch send failed";
      return { ok: false, error: msg };
    }
  }

  return { ok: true };
}

/**
 * Verified domain address for production. With RESEND_API_KEY only, Resend sandbox allows onboarding@resend.dev.
 */
export function getResendFromAddress(): string | null {
  const from = process.env.RESEND_FROM?.trim();
  if (from) return from;
  if (process.env.RESEND_API_KEY?.trim()) return "onboarding@resend.dev";
  return null;
}
