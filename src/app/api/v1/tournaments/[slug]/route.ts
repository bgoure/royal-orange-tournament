import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/v1/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const t = await prisma.tournament.findFirst({
    where: { slug, isPublished: true, archivedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      shortLabel: true,
      startDate: true,
      endDate: true,
      timezone: true,
      locationLabel: true,
      latitude: true,
      longitude: true,
      locations: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          isHeadquarters: true,
          sortOrder: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          brandName: true,
          primaryColor: true,
          accentColor: true,
          logoUrl: true,
        },
      },
    },
  });
  if (!t) return jsonError("Tournament not found", 404);
  return jsonOk({ tournament: t });
}
