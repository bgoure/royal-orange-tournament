import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

/** Invalidate every published tournament’s public layout (and its nested routes). */
export async function revalidatePublishedTournamentSites() {
  revalidatePath("/", "layout");
  const rows = await prisma.tournament.findMany({
    where: { isPublished: true },
    select: { slug: true },
  });
  for (const { slug } of rows) {
    revalidatePath(`/${slug}`, "layout");
  }
}
