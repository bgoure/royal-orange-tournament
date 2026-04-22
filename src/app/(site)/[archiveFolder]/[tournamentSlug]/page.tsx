import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentHomePublic } from "@/app/(site)/public-pages/tournament-home";

export default async function ArchivedTournamentHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);
  if (!tournament) return null;
  return TournamentHomePublic({ tournament, searchParams: await searchParams });
}
