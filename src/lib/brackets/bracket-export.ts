/** US Letter landscape at 192 dpi — one image/PDF page. */
export const BRACKET_EXPORT_DPI = 192;
export const BRACKET_EXPORT_PAGE_IN_W = 11;
export const BRACKET_EXPORT_PAGE_IN_H = 8.5;
export const BRACKET_EXPORT_PAGE_PX_W = Math.round(BRACKET_EXPORT_PAGE_IN_W * BRACKET_EXPORT_DPI);
export const BRACKET_EXPORT_PAGE_PX_H = Math.round(BRACKET_EXPORT_PAGE_IN_H * BRACKET_EXPORT_DPI);
export const BRACKET_EXPORT_MARGIN_PX = 48;
export const BRACKET_EXPORT_HEADER_PX = 112;

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
