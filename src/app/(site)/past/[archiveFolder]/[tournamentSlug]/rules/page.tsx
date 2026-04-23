import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentRulesPublic } from "@/app/(site)/public-pages/tournament-rules-public";

export default async function ArchivedRulesPage({
  params,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentRulesPublic({ tournament });
}
