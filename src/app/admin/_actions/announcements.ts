"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementEmailStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { deliverAnnouncementEmail } from "@/lib/services/announcement-email";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { announcementCreateSchema, announcementUpdateSchema } from "@/lib/validations/announcements-admin";
import type { Session } from "next-auth";
import type { Tournament } from "@prisma/client";

export type AnnouncementActionResult =
  | { ok: true; notice?: string }
  | { ok: false; error: string };

async function ctx(): Promise<{ session: Session; tournament: Tournament } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return {
      error:
        "Select a tournament on the public site (tournament switcher), then return here.",
    };
  }
  return { session, tournament };
}

function deny(): AnnouncementActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
}

export async function createAnnouncement(
  _prev: AnnouncementActionResult | undefined,
  formData: FormData,
): Promise<AnnouncementActionResult> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!can(c.session.user.role, "announcement:create")) return deny();

  const parsed = announcementCreateSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    priority: (formData.get("priority") === "on" ? "on" : "off") as "on" | "off",
    publishedAt: formData.get("publishedAt")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const sendEmail = formData.get("sendEmail") === "on";
  let publishedAt = new Date();
  if (parsed.data.publishedAt) {
    const d = new Date(parsed.data.publishedAt);
    if (!Number.isNaN(d.getTime())) publishedAt = d;
  }

  try {
    const row = await prisma.announcement.create({
      data: {
        tournamentId: c.tournament.id,
        title: parsed.data.title,
        body: parsed.data.body,
        priority: parsed.data.priority ?? false,
        notifySubscribers: sendEmail,
        publishedAt,
      },
    });

    await deliverAnnouncementEmail(row.id, sendEmail);

    const fresh = await prisma.announcement.findUnique({
      where: { id: row.id },
      select: { emailDeliveryStatus: true },
    });

    revalidatePath("/admin/announcements");
    revalidatePath("/");
    let notice: string | undefined;
    if (sendEmail) {
      if (fresh?.emailDeliveryStatus === "SENT") notice = "Announcement published and email sent.";
      else if (fresh?.emailDeliveryStatus === "SKIPPED_NO_SUBSCRIBERS")
        notice = "Saved. No coach/manager subscribers matched — no email sent.";
      else if (fresh?.emailDeliveryStatus === "SKIPPED_NO_API_KEY")
        notice = "Saved. Email skipped (configure RESEND_API_KEY and RESEND_FROM).";
      else if (fresh?.emailDeliveryStatus === "FAILED") notice = "Saved. Email failed — check status below.";
    }
    return { ok: true, notice };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create announcement";
    return { ok: false, error: msg };
  }
}

export async function updateAnnouncement(
  _prev: AnnouncementActionResult | undefined,
  formData: FormData,
): Promise<AnnouncementActionResult> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!can(c.session.user.role, "announcement:update")) return deny();

  const parsed = announcementUpdateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body"),
    priority: (formData.get("priority") === "on" ? "on" : "off") as "on" | "off",
    publishedAt: formData.get("publishedAt")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const sendEmail = formData.get("sendEmail") === "on";
  let publishedAt: Date | undefined;
  if (parsed.data.publishedAt) {
    const d = new Date(parsed.data.publishedAt);
    if (!Number.isNaN(d.getTime())) publishedAt = d;
  }

  try {
    const existing = await prisma.announcement.findFirst({
      where: { id: parsed.data.id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "Announcement not found" };

    await prisma.announcement.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        body: parsed.data.body,
        priority: parsed.data.priority ?? false,
        notifySubscribers:
          sendEmail || existing.emailDeliveryStatus === AnnouncementEmailStatus.SENT,
        ...(publishedAt ? { publishedAt } : {}),
      },
    });

    await deliverAnnouncementEmail(
      parsed.data.id,
      sendEmail && existing.emailDeliveryStatus !== AnnouncementEmailStatus.SENT,
    );

    const fresh = await prisma.announcement.findUnique({
      where: { id: parsed.data.id },
      select: { emailDeliveryStatus: true },
    });

    revalidatePath("/admin/announcements");
    revalidatePath("/");
    let notice: string | undefined;
    if (sendEmail) {
      if (fresh?.emailDeliveryStatus === "SENT")
        notice =
          existing.emailDeliveryStatus === "SENT"
            ? "Saved. Email was already sent earlier; no duplicate send."
            : "Email sent.";
      else if (fresh?.emailDeliveryStatus === "SKIPPED_NO_SUBSCRIBERS")
        notice = "Saved. No matching subscribers — no email sent.";
      else if (fresh?.emailDeliveryStatus === "SKIPPED_NO_API_KEY")
        notice = "Saved. Email skipped (Resend not configured).";
      else if (fresh?.emailDeliveryStatus === "FAILED") notice = "Saved. Email failed.";
    }
    return { ok: true, notice };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update announcement";
    return { ok: false, error: msg };
  }
}

export async function deleteAnnouncement(
  _prev: AnnouncementActionResult | undefined,
  formData: FormData,
): Promise<AnnouncementActionResult> {
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!can(c.session.user.role, "announcement:delete")) return deny();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };

  try {
    const existing = await prisma.announcement.findFirst({
      where: { id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "Announcement not found" };

    await prisma.announcement.delete({ where: { id } });
    revalidatePath("/admin/announcements");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete";
    return { ok: false, error: msg };
  }
}
