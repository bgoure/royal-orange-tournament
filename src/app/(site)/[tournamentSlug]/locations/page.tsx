import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentLocationsPublic } from "@/app/(site)/public-pages/tournament-locations-public";

export default async function LocationsPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentLocationsPublic({ tournament });
}
