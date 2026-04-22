import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentRulesPublic } from "@/app/(site)/public-pages/tournament-rules-public";

export default async function RulesPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentRulesPublic({ tournament });
}
