import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentFeedbackPublic } from "@/app/(site)/public-pages/tournament-feedback-public";

export default async function FeedbackPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentFeedbackPublic({ tournament });
}
