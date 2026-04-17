import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  const row = await prisma.teamLogo.findUnique({
    where: { teamId },
    select: { mimeType: true, data: true },
  });
  if (!row) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(row.data, {
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
