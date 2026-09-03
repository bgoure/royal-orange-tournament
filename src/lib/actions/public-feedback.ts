"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { sendPublicFeedbackNotification } from "@/lib/email/feedback-email";
import { listAdminNotificationEmails } from "@/lib/services/admin-notification-emails";
import { clientIpFromHeaders, consumeRateLimit, isFirstOccurrence } from "@/lib/rate-limit";
import { getPublishedTournamentBySlugForActions } from "@/lib/tournament-context";
import { publicFeedbackSchema } from "@/lib/validations/feedback";

export type FeedbackActionState =
  | { ok: false; error?: string; fieldErrors?: { message?: string; contactEmail?: string } }
  | { ok: true };

/** Hard ceiling on any single submitted field before validation even runs. */
const MAX_FIELD_CHARS = 10_000;
/** Submissions per IP per window. */
const SUBMIT_LIMIT = 5;
const SUBMIT_WINDOW_MS = 10 * 60 * 1000;
/** Outbound notification emails per tournament per window. */
const EMAIL_LIMIT = 20;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
/** Identical submissions inside this window are accepted but stored/sent once. */
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

const TOO_MANY = "Too many submissions from this device. Please try again later.";
const GENERIC_FAILURE = "We couldn’t save that. Please try again in a moment.";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function submitFeedbackAction(
  _prev: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const raw = {
    tournamentSlug: field(formData, "tournamentSlug"),
    message: field(formData, "message"),
    contactEmail: field(formData, "contactEmail"),
    _gotcha: field(formData, "_gotcha"),
  };

  if (raw._gotcha.trim() !== "") {
    return { ok: true };
  }

  // Reject oversized payloads before spending validation or database work on them.
  if (Object.values(raw).some((v) => v.length > MAX_FIELD_CHARS)) {
    return { ok: false, error: "That message is too long. Please shorten it and try again." };
  }

  const parsed = publicFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      fieldErrors: {
        message: flat.message?.[0],
        contactEmail: flat.contactEmail?.[0],
      },
    };
  }

  const h = await headers();
  const ip = clientIpFromHeaders(h);

  const perIp = await consumeRateLimit({
    scope: "feedback:ip",
    subject: `${ip}|${parsed.data.tournamentSlug.toLowerCase()}`,
    limit: SUBMIT_LIMIT,
    windowMs: SUBMIT_WINDOW_MS,
  });
  if (!perIp.ok) {
    return { ok: false, error: TOO_MANY };
  }

  const tournament = await getPublishedTournamentBySlugForActions(parsed.data.tournamentSlug);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  // Double-submits (impatient taps, action retries) shouldn't create rows or send mail twice.
  const fresh = await isFirstOccurrence({
    scope: "feedback:duplicate",
    subject: [
      tournament.id,
      parsed.data.contactEmail?.toLowerCase() ?? "",
      parsed.data.message.trim().replace(/\s+/g, " ").toLowerCase(),
    ].join("|"),
    windowMs: DUPLICATE_WINDOW_MS,
  });
  if (!fresh) {
    return { ok: true };
  }

  const userAgent = h.get("user-agent")?.slice(0, 2000) ?? null;
  const sourcePath = field(formData, "sourcePath").slice(0, 500) || null;

  let row: { id: string };
  try {
    row = await prisma.publicFeedback.create({
      data: {
        tournamentId: tournament.id,
        message: parsed.data.message,
        contactEmail: parsed.data.contactEmail ?? null,
        userAgent,
        sourcePath,
      },
      select: { id: true },
    });
  } catch (e) {
    console.error("[feedback] save failed:", e);
    return { ok: false, error: GENERIC_FAILURE };
  }

  const emailBudget = await consumeRateLimit({
    scope: "feedback:email",
    subject: tournament.id,
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailBudget.ok) {
    // Feedback is stored either way; skip the notification instead of flooding inboxes.
    console.warn(`[feedback] email budget exhausted for tournament ${tournament.id}; stored only`);
    return { ok: true };
  }

  const adminEmails = await listAdminNotificationEmails();
  const envExtra = process.env.FEEDBACK_NOTIFY_EMAIL?.trim();
  const recipients: string[] = [...adminEmails];
  if (envExtra && !recipients.some((e) => e.toLowerCase() === envExtra.toLowerCase())) {
    recipients.push(envExtra);
  }

  if (recipients.length > 0) {
    const sent = await sendPublicFeedbackNotification({
      to: recipients,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      message: parsed.data.message,
      contactEmail: parsed.data.contactEmail ?? null,
      feedbackId: row.id,
    });
    if (!sent.ok) {
      console.warn("[feedback] email notify failed:", sent.error);
    }
  } else {
    console.warn("[feedback] no ADMIN emails in DB and FEEDBACK_NOTIFY_EMAIL unset; skipping email");
  }

  return { ok: true };
}
