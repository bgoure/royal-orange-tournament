import { getArchivedPublishedTournamentByFolderAndSlug } from "@/lib/tournament-context";
import { TournamentSchedulePublic } from "@/app/(site)/public-pages/tournament-schedule-public";

export default async function ArchivedSchedulePage({
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

  return TournamentSchedulePublic({ tournament, searchParams: sp });
}
