import { prisma } from "@/lib/db";

/** URL-safe slug from a display name (tournament title, etc.). */
export function slugifyTournamentName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s.length > 0 ? s : "tournament";
}

/**
 * Reserves a unique `Tournament.slug` by appending `-2`, `-3`, … if the base is taken.
 */
export async function allocateUniqueTournamentSlug(displayName: string): Promise<string> {
  const base = slugifyTournamentName(displayName);
  let candidate = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.tournament.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 10_000) {
      throw new Error("Could not allocate a unique tournament slug");
    }
  }
}
