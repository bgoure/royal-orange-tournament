import { notFound } from "next/navigation";
import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentAnnouncementsPublic } from "@/app/(site)/public-pages/tournament-announcements-public";

export default async function ArchivedAnnouncementsPage({
  params,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  if (!tournament || !tournament.showPublicAnnouncements) {
    notFound();
  }

  return TournamentAnnouncementsPublic({ tournament });
}
