import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentSettingsPublic } from "@/app/(site)/public-pages/tournament-settings-public";

export default async function SettingsPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentSettingsPublic({ tournament });
}
