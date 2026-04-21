"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { sendPublicFeedbackNotification } from "@/lib/email/feedback-email";
import { listAdminNotificationEmails } from "@/lib/services/admin-notification-emails";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { publicFeedbackSchema } from "@/lib/validations/feedback";

export type FeedbackActionState =
  | { ok: false; error?: string; fieldErrors?: { message?: string; contactEmail?: string } }
  | { ok: true };

export async function submitFeedbackAction(
  _prev: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const raw = {
    tournamentSlug: String(formData.get("tournamentSlug") ?? ""),
    message: String(formData.get("message") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    _gotcha: String(formData.get("_gotcha") ?? ""),
  };

  if (raw._gotcha.trim() !== "") {
    return { ok: true };
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

  const tournament = await getPublishedTournamentBySlug(parsed.data.tournamentSlug);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  const h = await headers();
  const userAgent = h.get("user-agent")?.slice(0, 2000) ?? null;
  const sourcePath = String(formData.get("sourcePath") ?? "").slice(0, 500) || null;

  const row = await prisma.publicFeedback.create({
    data: {
      tournamentId: tournament.id,
      message: parsed.data.message,
      contactEmail: parsed.data.contactEmail ?? null,
      userAgent,
      sourcePath,
    },
  });

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
