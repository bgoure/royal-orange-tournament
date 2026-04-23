import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentLocationsPublic } from "@/app/(site)/public-pages/tournament-locations-public";

export default async function ArchivedLocationsPage({
  params,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentLocationsPublic({ tournament });
}
