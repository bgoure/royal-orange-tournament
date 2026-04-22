import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";

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
