import { redirect } from "next/navigation";
import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentResultsPublic } from "@/app/(site)/public-pages/tournament-results-public";
import { isBracketOnlyTournament } from "@/lib/services/tournament-format";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";

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

  if (await isBracketOnlyTournament(tournament.id)) {
    redirect(tournamentPathFromBase(tournamentPublicBasePath(tournament), "brackets"));
  }

  return TournamentResultsPublic({ tournament, searchParams: sp });
}
