import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentBracketsPublic } from "@/app/(site)/public-pages/tournament-brackets-public";

export default async function ArchivedBracketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentBracketsPublic({ tournament, searchParams: sp });
}
