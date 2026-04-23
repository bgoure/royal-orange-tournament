import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentFeedbackPublic } from "@/app/(site)/public-pages/tournament-feedback-public";

export default async function ArchivedFeedbackPage({
  params,
}: {
  params: Promise<{ archiveFolder: string; tournamentSlug: string }>;
}) {
  const { archiveFolder, tournamentSlug } = await params;
  const tournament = await getArchivedPublishedTournamentByFolderAndSlug(archiveFolder, tournamentSlug);

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentFeedbackPublic({ tournament });
}
