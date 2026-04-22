import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentResultsPublic } from "@/app/(site)/public-pages/tournament-results-public";

export default async function ResultsPage({
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

  return TournamentResultsPublic({ tournament, searchParams: sp });
}
