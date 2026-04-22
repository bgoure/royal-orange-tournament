import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentSocialPublic } from "@/app/(site)/public-pages/tournament-social-public";

export default async function SocialPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentSocialPublic({ tournament });
}
