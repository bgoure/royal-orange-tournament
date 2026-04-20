import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ sponsorId: string }> },
) {
  const { sponsorId } = await context.params;
  const row = await prisma.tournamentSponsor.findUnique({
    where: { id: sponsorId },
    select: {
      mimeType: true,
      data: true,
      tournament: { select: { isPublished: true } },
    },
  });
  if (!row || !row.tournament.isPublished) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(row.data, {
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
