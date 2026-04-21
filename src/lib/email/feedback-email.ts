import { Resend } from "resend";
import { getResendFromAddress } from "@/lib/email/resend";

/**
 * Sends one notification to the given addresses when Resend is configured.
 * Failures are non-fatal — feedback is already stored in the database.
 */
export async function sendPublicFeedbackNotification(opts: {
  to: string[];
  tournamentName: string;
  tournamentSlug: string;
  message: string;
  contactEmail: string | null;
  feedbackId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const recipients = [...new Set(opts.to.map((t) => t.trim()).filter(Boolean))];
  if (recipients.length === 0) {
    return { ok: false, error: "No recipients" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const from = getResendFromAddress();
  if (!from) {
    return { ok: false, error: "No Resend from address" };
  }

  const resend = new Resend(apiKey);
  const subject = `[Tourney Hub feedback] ${opts.tournamentName}`;
  const text = [
    `Tournament: ${opts.tournamentName} (slug: ${opts.tournamentSlug})`,
    `Row id: ${opts.feedbackId}`,
    opts.contactEmail ? `Reply to: ${opts.contactEmail}` : "Reply to: (not provided)",
    "",
    "---",
    "",
    opts.message.trim(),
  ].join("\n");

  const { error } = await resend.emails.send({
    from,
    to: recipients,
    subject,
    text,
  });

  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "Resend send failed";
    return { ok: false, error: msg };
  }

  return { ok: true };
}
