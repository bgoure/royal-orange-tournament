import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { buildTournamentPublicMetadata } from "@/lib/tournament-public-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
}): Promise<Metadata> {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  if (!tournament) return { title: "Tournament" };
  return buildTournamentPublicMetadata(tournament);
}

export default async function ArchivedTournamentSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  if (!tournament) notFound();
  return <SiteShell tournament={tournament}>{children}</SiteShell>;
}
