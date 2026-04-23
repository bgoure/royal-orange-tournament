import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentResultsPublic } from "@/app/(site)/public-pages/tournament-results-public";

export default async function ArchivedResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
  searchParams: Promise<{ day?: string; team?: string; field?: string; division?: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentResultsPublic({ tournament, searchParams: sp });
}
