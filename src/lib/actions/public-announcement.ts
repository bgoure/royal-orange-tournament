"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementEmailStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deliverAnnouncementEmail } from "@/lib/services/announcement-email";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { announcementUpdateSchema } from "@/lib/validations/announcements-admin";

export type PublicAnnouncementResult = { ok: true; notice?: string } | { ok: false; error: string };

function deny(msg: string): PublicAnnouncementResult {
  return { ok: false, error: msg };
}

type AnnouncementCtxOk = { tournamentId: string; slug: string };

async function assertAdminAnnouncementContext(
  formData: FormData,
): Promise<AnnouncementCtxOk | PublicAnnouncementResult> {
  const session = await auth();
  if (!session?.user?.id) return deny("You must be signed in.");
  if (session.user.role !== "ADMIN") return deny("Only ADMIN can edit announcements here.");

  const slug = String(formData.get("tournamentSlug") ?? "").trim();
  if (!slug) return deny("Missing tournament.");

  const tournament = await getPublishedTournamentBySlug(slug);
  if (!tournament) return deny("Tournament not found.");

  return { tournamentId: tournament.id, slug: tournament.slug };
}

function isCtxOk(v: AnnouncementCtxOk | PublicAnnouncementResult): v is AnnouncementCtxOk {
  return "tournamentId" in v && "slug" in v;
}

export async function updatePublicAnnouncementFromSite(
  _prev: PublicAnnouncementResult | undefined,
  formData: FormData,
): Promise<PublicAnnouncementResult> {
  const ctx = await assertAdminAnnouncementContext(formData);
  if (!isCtxOk(ctx)) return ctx;

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
      where: { id: parsed.data.id, tournamentId: ctx.tournamentId },
    });
    if (!existing) return deny("Announcement not found.");

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

    revalidatePath(`/${ctx.slug}`, "layout");
    revalidatePath(`/${ctx.slug}/announcements`);
    revalidatePath("/admin/announcements");
    await revalidatePublishedTournamentSites();

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
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update announcement" };
  }
}

export async function deletePublicAnnouncementFromSite(
  _prev: PublicAnnouncementResult | undefined,
  formData: FormData,
): Promise<PublicAnnouncementResult> {
  const ctx = await assertAdminAnnouncementContext(formData);
  if (!isCtxOk(ctx)) return ctx;

  const id = formData.get("id")?.toString();
  if (!id) return deny("Missing id");

  try {
    const existing = await prisma.announcement.findFirst({
      where: { id, tournamentId: ctx.tournamentId },
    });
    if (!existing) return deny("Announcement not found.");

    await prisma.announcement.delete({ where: { id } });
    revalidatePath(`/${ctx.slug}`, "layout");
    revalidatePath(`/${ctx.slug}/announcements`);
    revalidatePath("/admin/announcements");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}
