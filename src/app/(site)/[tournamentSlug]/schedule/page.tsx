import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentSchedulePublic } from "@/app/(site)/public-pages/tournament-schedule-public";

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentSlug: string }>;
  searchParams: Promise<{ day?: string; team?: string; field?: string; division?: string }>;
}) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentSchedulePublic({ tournament, searchParams: sp });
}
