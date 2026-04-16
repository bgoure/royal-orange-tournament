"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import { faqCreateSchema, faqUpdateSchema } from "@/lib/validations/content-admin";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

function nextSortOrder(tournamentId: string) {
  return prisma.faqItem
    .aggregate({ where: { tournamentId }, _max: { sortOrder: true } })
    .then((r) => (r._max.sortOrder ?? -1) + 1);
}

export async function createFaqItem(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = faqCreateSchema.safeParse({
    question: formData.get("question"),
    answer: formData.get("answer"),
    sortOrder: formData.get("sortOrder")?.toString(),
    published: (formData.get("published") === "on" ? "on" : "off") as "on" | "off",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  let sortOrder = await nextSortOrder(c.tournament.id);
  const raw = parsed.data.sortOrder?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) sortOrder = n;
  }

  try {
    await prisma.faqItem.create({
      data: {
        tournamentId: c.tournament.id,
        question: parsed.data.question,
        answer: parsed.data.answer,
        sortOrder,
        published: parsed.data.published ?? true,
      },
    });
    revalidatePath("/admin/faq");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create FAQ" };
  }
}

export async function updateFaqItem(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = faqUpdateSchema.safeParse({
    id: formData.get("id"),
    question: formData.get("question"),
    answer: formData.get("answer"),
    sortOrder: formData.get("sortOrder")?.toString(),
    published: (formData.get("published") === "on" ? "on" : "off") as "on" | "off",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  let sortOrder: number | undefined;
  const raw = parsed.data.sortOrder?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) sortOrder = n;
  }

  try {
    const existing = await prisma.faqItem.findFirst({
      where: { id: parsed.data.id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "FAQ not found" };

    await prisma.faqItem.update({
      where: { id: parsed.data.id },
      data: {
        question: parsed.data.question,
        answer: parsed.data.answer,
        published: parsed.data.published ?? existing.published,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    revalidatePath("/admin/faq");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update FAQ" };
  }
}

export async function deleteFaqItem(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };

  try {
    const existing = await prisma.faqItem.findFirst({
      where: { id, tournamentId: c.tournament.id },
    });
    if (!existing) return { ok: false, error: "FAQ not found" };

    await prisma.faqItem.delete({ where: { id } });
    revalidatePath("/admin/faq");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}

export async function moveFaqItem(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const id = formData.get("id")?.toString();
  const direction = formData.get("direction")?.toString();
  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid move request" };
  }

  try {
    const rows = await prisma.faqItem.findMany({
      where: { tournamentId: c.tournament.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
    });
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return { ok: false, error: "FAQ not found" };
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return { ok: true };

    const a = rows[i];
    const b = rows[j];
    await prisma.$transaction([
      prisma.faqItem.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      prisma.faqItem.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    revalidatePath("/admin/faq");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reorder" };
  }
}
