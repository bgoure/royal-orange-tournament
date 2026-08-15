import { DateTime } from "luxon";

/** US Letter landscape at 192 dpi — one image/PDF page. */
export const BRACKET_EXPORT_DPI = 192;
export const BRACKET_EXPORT_PAGE_IN_W = 11;
export const BRACKET_EXPORT_PAGE_IN_H = 8.5;
export const BRACKET_EXPORT_PAGE_PX_W = Math.round(BRACKET_EXPORT_PAGE_IN_W * BRACKET_EXPORT_DPI);
export const BRACKET_EXPORT_PAGE_PX_H = Math.round(BRACKET_EXPORT_PAGE_IN_H * BRACKET_EXPORT_DPI);
export const BRACKET_EXPORT_MARGIN_PX = 48;
/** Title + subtitle block sitting just above the tree (not a tall top banner). */
export const BRACKET_EXPORT_TITLE_PX = 88;
export const BRACKET_EXPORT_FOOTER_PX = 28;
export const BRACKET_EXPORT_TITLE_GAP_PX = 16;

export function bracketExportBasename(parts: {
  tournamentName: string;
  divisionName?: string | null;
}): string {
  const slug = [parts.tournamentName, parts.divisionName, "bracket"]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "bracket";
}

/** Avoid "AAA · AAA PLAYOFFS" when the bracket name already includes the division. */
export function bracketExportSubtitle(
  divisionName?: string | null,
  bracketName?: string | null,
): string {
  const div = (divisionName ?? "").trim();
  const br = (bracketName ?? "").trim();
  if (!div) return br;
  if (!br) return div;
  const divNorm = div.toLowerCase();
  const brNorm = br.toLowerCase();
  if (brNorm === divNorm) return br;
  if (
    brNorm.startsWith(`${divNorm} `) ||
    brNorm.startsWith(`${divNorm}·`) ||
    brNorm.startsWith(`${divNorm} ·`)
  ) {
    return br;
  }
  return `${div} · ${br}`;
}

export function formatBracketExportCreatedAt(now: Date, timeZone?: string | null): string {
  const zone = timeZone?.trim() || "utc";
  const dt = DateTime.fromJSDate(now, { zone });
  const stamp = dt.isValid ? dt.toFormat("LLL d, yyyy") : DateTime.fromJSDate(now).toFormat("LLL d, yyyy");
  return `created at ${stamp}`;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function waitForExportPaint(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(
    imgs.map((img) => {
      img.loading = "eager";
      if (img.complete && img.naturalWidth > 0) {
        return img.decode?.().catch(() => undefined) ?? Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    }),
  );
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  window.dispatchEvent(new Event("bracket-zoom-change"));
  await new Promise((r) => setTimeout(r, 420));
}

export function fitScale(naturalW: number, naturalH: number, availW: number, availH: number): number {
  if (naturalW < 1 || naturalH < 1) return 1;
  return Math.min(availW / naturalW, availH / naturalH);
}
