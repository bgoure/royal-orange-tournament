import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

/** Invalidate every published tournament’s public layout (live and archived paths). */
export async function revalidatePublishedTournamentSites() {
  revalidatePath("/", "layout");
  const rows = await prisma.tournament.findMany({
    where: { isPublished: true },
    select: { slug: true, archiveFolder: true, archivedAt: true },
  });
  for (const row of rows) {
    revalidatePath(tournamentPublicBasePath(row), "layout");
  }
}
