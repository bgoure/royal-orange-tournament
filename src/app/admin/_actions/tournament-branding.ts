"use server";

import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import { tournamentBrandingFormSchema } from "@/lib/validations/tournament-branding";
import { assertContentManage, contentCtx, contentDeny, type ContentActionResult } from "./content-shared";

function brandingDir(slug: string) {
  return path.join(process.cwd(), "public", "branding", slug);
}

async function revalidateBranding() {
  revalidatePath("/", "layout");
  await revalidatePublishedTournamentSites();
  revalidatePath("/admin/tournament-settings");
}

export async function updateTournamentBranding(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const parsed = tournamentBrandingFormSchema.safeParse({
    pwaIcon192Url: formData.get("pwaIcon192Url"),
    pwaIcon512Url: formData.get("pwaIcon512Url"),
    gameSheetLogoLeftUrl: formData.get("gameSheetLogoLeftUrl"),
    gameSheetLogoRightUrl: formData.get("gameSheetLogoRightUrl"),
    pwaThemeColor: formData.get("pwaThemeColor"),
    socialWebsiteUrl: formData.get("socialWebsiteUrl"),
    socialFacebookUrl: formData.get("socialFacebookUrl"),
    socialInstagramUrl: formData.get("socialInstagramUrl"),
    socialXUrl: formData.get("socialXUrl"),
    socialYoutubeUrl: formData.get("socialYoutubeUrl"),
    socialEmail: formData.get("socialEmail"),
    socialShowWebsite: formData.get("socialShowWebsite"),
    socialShowFacebook: formData.get("socialShowFacebook"),
    socialShowInstagram: formData.get("socialShowInstagram"),
    socialShowX: formData.get("socialShowX"),
    socialShowYoutube: formData.get("socialShowYoutube"),
    socialShowEmail: formData.get("socialShowEmail"),
    socialWebsiteSubtext: formData.get("socialWebsiteSubtext"),
    socialFacebookSubtext: formData.get("socialFacebookSubtext"),
    socialInstagramSubtext: formData.get("socialInstagramSubtext"),
    socialXSubtext: formData.get("socialXSubtext"),
    socialYoutubeSubtext: formData.get("socialYoutubeSubtext"),
    socialEmailSubtext: formData.get("socialEmailSubtext"),
  });

  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid values";
    return { ok: false, error: msg };
  }

  const d = parsed.data;
  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: {
        pwaIcon192Url: d.pwaIcon192Url ?? null,
        pwaIcon512Url: d.pwaIcon512Url ?? null,
        gameSheetLogoLeftUrl: d.gameSheetLogoLeftUrl ?? null,
        gameSheetLogoRightUrl: d.gameSheetLogoRightUrl ?? null,
        pwaThemeColor: d.pwaThemeColor ?? null,
        socialWebsiteUrl: d.socialWebsiteUrl ?? null,
        socialFacebookUrl: d.socialFacebookUrl ?? null,
        socialInstagramUrl: d.socialInstagramUrl ?? null,
        socialXUrl: d.socialXUrl ?? null,
        socialYoutubeUrl: d.socialYoutubeUrl ?? null,
        socialEmail: d.socialEmail ?? null,
        socialShowWebsite: d.socialShowWebsite,
        socialShowFacebook: d.socialShowFacebook,
        socialShowInstagram: d.socialShowInstagram,
        socialShowX: d.socialShowX,
        socialShowYoutube: d.socialShowYoutube,
        socialShowEmail: d.socialShowEmail,
        socialWebsiteSubtext: d.socialWebsiteSubtext ?? null,
        socialFacebookSubtext: d.socialFacebookSubtext ?? null,
        socialInstagramSubtext: d.socialInstagramSubtext ?? null,
        socialXSubtext: d.socialXSubtext ?? null,
        socialYoutubeSubtext: d.socialYoutubeSubtext ?? null,
        socialEmailSubtext: d.socialEmailSubtext ?? null,
      },
    });
    await revalidateBranding();
    revalidatePath("/admin/print-sheets");
    return { ok: true, notice: "Branding and links saved." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

/** Copy `public/icon-192.png` and `icon-512.png` into `public/branding/{slug}/` and point the tournament at them. */
export async function installDefaultPwaPlaceholderIcons(
  _prev: ContentActionResult | undefined,
  _formData: FormData,
): Promise<ContentActionResult> {
  void _prev;
  void _formData;
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const slug = c.tournament.slug;
  const dir = brandingDir(slug);
  const src192 = path.join(process.cwd(), "public", "icon-192.png");
  const src512 = path.join(process.cwd(), "public", "icon-512.png");
  const dest192 = path.join(dir, "icon-192.png");
  const dest512 = path.join(dir, "icon-512.png");

  try {
    await mkdir(dir, { recursive: true });
    await copyFile(src192, dest192);
    await copyFile(src512, dest512);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Copy failed";
    return {
      ok: false,
      error: `${msg} — On serverless hosts you may need to paste icon URLs instead, or deploy from an environment with a writable filesystem.`,
    };
  }

  const base = `/branding/${slug}`;
  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: {
        pwaIcon192Url: `${base}/icon-192.png`,
        pwaIcon512Url: `${base}/icon-512.png`,
      },
    });
    revalidateBranding();
    return { ok: true, notice: "Placeholder icons installed under /branding (commit these files or use URLs in production)." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Database update failed" };
  }
}

/** Upload one PWA icon (192 or 512). Writes under `public/branding/{slug}/`. */
export async function uploadPwaBrandingIcon(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const sizeRaw = formData.get("size");
  if (sizeRaw !== "192" && sizeRaw !== "512") {
    return { ok: false, error: "Invalid icon size." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file." };
  }
  if (file.size > 800_000) {
    return { ok: false, error: "File too large (max 800KB)." };
  }
  const mime = file.type;
  if (mime !== "image/png" && mime !== "image/jpeg") {
    return { ok: false, error: "Use PNG or JPEG." };
  }

  const ext = mime === "image/png" ? "png" : "jpg";
  const filename = sizeRaw === "512" ? `icon-512.${ext}` : `icon-192.${ext}`;
  const slug = c.tournament.slug;
  const dir = brandingDir(slug);
  const outPath = path.join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(outPath, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Write failed";
    return {
      ok: false,
      error: `${msg} — Icon upload needs a writable public/ folder (typical on VPS or local dev; not on default Vercel).`,
    };
  }

  const publicUrl = `/branding/${slug}/${filename}`;
  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data: sizeRaw === "512" ? { pwaIcon512Url: publicUrl } : { pwaIcon192Url: publicUrl },
    });
    await revalidateBranding();
    return { ok: true, notice: `Saved ${sizeRaw}×${sizeRaw} icon as ${publicUrl}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Database update failed" };
  }
}

/** Upload left or right game sheet header logo under `public/branding/{slug}/`. */
export async function uploadGameSheetBrandingLogo(
  _prev: ContentActionResult | undefined,
  formData: FormData,
): Promise<ContentActionResult> {
  const c = await contentCtx();
  if ("error" in c) return { ok: false, error: c.error };
  if (!assertContentManage(c.session.user.role)) return contentDeny();

  const slotRaw = formData.get("slot");
  if (slotRaw !== "left" && slotRaw !== "right") {
    return { ok: false, error: "Invalid game sheet logo slot." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file." };
  }
  if (file.size > 800_000) {
    return { ok: false, error: "File too large (max 800KB)." };
  }
  const mime = file.type;
  if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/webp") {
    return { ok: false, error: "Use PNG, JPEG, or WebP." };
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const filename = slotRaw === "left" ? `game-sheet-left.${ext}` : `game-sheet-right.${ext}`;
  const slug = c.tournament.slug;
  const dir = brandingDir(slug);
  const outPath = path.join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(outPath, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Write failed";
    return {
      ok: false,
      error: `${msg} — Game sheet logo upload needs a writable public/ folder (typical on VPS or local dev; not on default Vercel).`,
    };
  }

  const publicUrl = `/branding/${slug}/${filename}`;
  try {
    await prisma.tournament.update({
      where: { id: c.tournament.id },
      data:
        slotRaw === "left"
          ? { gameSheetLogoLeftUrl: publicUrl }
          : { gameSheetLogoRightUrl: publicUrl },
    });
    await revalidateBranding();
    revalidatePath("/admin/print-sheets");
    return { ok: true, notice: `Saved game sheet ${slotRaw} logo as ${publicUrl}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Database update failed" };
  }
}
