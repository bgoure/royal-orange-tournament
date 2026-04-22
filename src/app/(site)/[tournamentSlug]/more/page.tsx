import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentMorePublic } from "@/app/(site)/public-pages/tournament-more-public";

export default async function MorePage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentMorePublic({ tournament });
}
