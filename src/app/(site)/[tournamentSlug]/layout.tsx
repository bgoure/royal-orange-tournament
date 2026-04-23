import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import {
  getArchivedPublishedTournamentBySlug,
  getPublishedTournamentBySlug,
} from "@/lib/tournament-context";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";
import { TOURNEY_PATHNAME_HEADER } from "@/lib/tourney-request";

function pathAfterFirstSegment(pathname: string, slug: string): string | null {
  const pathOnly = pathname.split("?")[0] ?? pathname;
  const parts = pathOnly.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0]!.toLowerCase() !== slug.toLowerCase()) return null;
  return parts.slice(1).join("/");
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
  if (!archived) notFound();

  const pathname = (await headers()).get(TOURNEY_PATHNAME_HEADER) ?? `/${tournamentSlug}`;
  const canonicalBase = tournamentPublicBasePath(archived);
  const rest = pathAfterFirstSegment(pathname, tournamentSlug) ?? "";
  const target =
    rest.length > 0 ? tournamentPathFromBase(canonicalBase, ...rest.split("/").filter(Boolean)) : canonicalBase;
  permanentRedirect(target);
}
