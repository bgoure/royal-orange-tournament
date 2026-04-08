import { AnnouncementEmailStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getResendFromAddress, sendAnnouncementBulk } from "@/lib/email/resend";

/**
 * Tournament subscribers who receive announcement emails.
 * Rows with no role label are included (legacy / general opt-in).
 * Labeled rows must look like coach/manager/director (case-insensitive).
 */
export function subscriberIncludedForAnnouncementEmail(roleLabel: string | null): boolean {
  if (roleLabel == null) return true;
  const t = roleLabel.trim();
  if (t.length === 0) return true;
  const r = t.toLowerCase();
  return r.includes("coach") || r.includes("manager") || r.includes("director");
}

export async function listAnnouncementRecipientEmails(tournamentId: string): Promise<string[]> {
  const rows = await prisma.tournamentSubscriber.findMany({
    where: { tournamentId },
    select: { email: true, roleLabel: true },
  });
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!subscriberIncludedForAnnouncementEmail(row.roleLabel)) continue;
    const e = row.email.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(row.email.trim());
  }
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailBodies(title: string, body: string, tournamentName: string) {
  const html = `
<!doctype html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #18181b;">
  <p style="color:#71717a;font-size:13px;">${escapeHtml(tournamentName)}</p>
  <h1 style="font-size:18px;margin:0 0 12px;">${escapeHtml(title)}</h1>
  <div style="white-space:pre-wrap;font-size:15px;">${escapeHtml(body)}</div>
</body></html>`.trim();
  const text = `${tournamentName}\n\n${title}\n\n${body}`;
  return { html, text };
}

const CLAIMABLE: AnnouncementEmailStatus[] = [
  AnnouncementEmailStatus.NOT_SENT,
  AnnouncementEmailStatus.FAILED,
  AnnouncementEmailStatus.SKIPPED_NO_SUBSCRIBERS,
  AnnouncementEmailStatus.SKIPPED_NO_API_KEY,
];

/**
 * When `attemptSend` is true (admin checked "Send as email" on this save), deliver once.
 * Duplicate sends blocked by claim + SENT status.
 */
export async function deliverAnnouncementEmail(
  announcementId: string,
  attemptSend: boolean,
): Promise<void> {
  if (!attemptSend) return;

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: { tournament: { select: { id: true, name: true } } },
  });
  if (!announcement) return;

  const claimed = await prisma.announcement.updateMany({
    where: {
      id: announcementId,
      emailDeliveryStatus: { in: CLAIMABLE },
    },
    data: {
      emailDeliveryStatus: AnnouncementEmailStatus.SENDING,
      emailError: null,
    },
  });
  if (claimed.count === 0) return;

  if (!process.env.RESEND_API_KEY?.trim()) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        emailDeliveryStatus: AnnouncementEmailStatus.SKIPPED_NO_API_KEY,
        emailError: "RESEND_API_KEY not configured",
      },
    });
    return;
  }

  const from = getResendFromAddress();
  if (!from) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        emailDeliveryStatus: AnnouncementEmailStatus.SKIPPED_NO_API_KEY,
        emailError: "RESEND_FROM not configured",
      },
    });
    return;
  }

  const recipients = await listAnnouncementRecipientEmails(announcement.tournamentId);
  if (recipients.length === 0) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        emailDeliveryStatus: AnnouncementEmailStatus.SKIPPED_NO_SUBSCRIBERS,
        emailError: null,
      },
    });
    return;
  }

  const { html, text } = buildEmailBodies(
    announcement.title,
    announcement.body,
    announcement.tournament.name,
  );

  const result = await sendAnnouncementBulk({
    recipients,
    from,
    subject: announcement.priority ? `[Important] ${announcement.title}` : announcement.title,
    html,
    text,
    idempotencyKeyPrefix: announcementId,
  });

  if (!result.ok) {
    const err = result.error.slice(0, 2000);
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        emailDeliveryStatus: AnnouncementEmailStatus.FAILED,
        emailError: err,
      },
    });
    return;
  }

  await prisma.announcement.update({
    where: { id: announcementId },
    data: {
      emailDeliveryStatus: AnnouncementEmailStatus.SENT,
      emailSentAt: new Date(),
      emailError: null,
    },
  });
}
