import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import {
  getArchivedPublishedTournamentBySlug,
  getPublishedTournamentBySlug,
  getTournamentForSlugRedirect,
} from "@/lib/tournament-context";
import { buildTournamentPublicMetadata } from "@/lib/tournament-public-metadata";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";
import { TOURNEY_PATHNAME_HEADER } from "@/lib/tourney-request";

function pathAfterFirstSegment(pathname: string, slug: string): string | null {
  const pathOnly = pathname.split("?")[0] ?? pathname;
  const parts = pathOnly.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0]!.toLowerCase() !== slug.toLowerCase()) return null;
  return parts.slice(1).join("/");
}

function redirectTargetForSlugChange(
  pathname: string,
  requestedSlug: string,
  tournament: { slug: string; archiveFolder: string | null; archivedAt: Date | null },
): string {
  const canonicalBase = tournamentPublicBasePath(tournament);
  const rest = pathAfterFirstSegment(pathname, requestedSlug) ?? "";
  return rest.length > 0
    ? tournamentPathFromBase(canonicalBase, ...rest.split("/").filter(Boolean))
    : canonicalBase;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentSlug: string }>;
}): Promise<Metadata> {
  const { tournamentSlug } = await params;
  const live = await getPublishedTournamentBySlug(tournamentSlug);
  if (live) return buildTournamentPublicMetadata(live);
  const archived = await getArchivedPublishedTournamentBySlug(tournamentSlug);
  if (archived) return buildTournamentPublicMetadata(archived);
  const viaRedirect = await getTournamentForSlugRedirect(tournamentSlug);
  if (viaRedirect) return buildTournamentPublicMetadata(viaRedirect);
  return { title: "Tournament" };
}

export default async function TournamentSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tournamentSlug: string }>;
}) {
  const { tournamentSlug } = await params;
  const live = await getPublishedTournamentBySlug(tournamentSlug);
  if (live) {
    return <SiteShell tournament={live}>{children}</SiteShell>;
  }

  const archived = await getArchivedPublishedTournamentBySlug(tournamentSlug);
  if (archived) {
    const pathname = (await headers()).get(TOURNEY_PATHNAME_HEADER) ?? `/${tournamentSlug}`;
    permanentRedirect(redirectTargetForSlugChange(pathname, tournamentSlug, archived));
  }

  const viaRedirect = await getTournamentForSlugRedirect(tournamentSlug);
  if (viaRedirect) {
    const pathname = (await headers()).get(TOURNEY_PATHNAME_HEADER) ?? `/${tournamentSlug}`;
    permanentRedirect(redirectTargetForSlugChange(pathname, tournamentSlug, viaRedirect));
  }

  notFound();
}
