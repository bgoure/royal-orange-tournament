import { RoyalOrangeClassicRules } from "@/components/content/RoyalOrangeClassicRules";
import { PageTitle } from "@/components/ui/PublicHeading";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function RulesPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Rules and Resources</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">Tournament rules for {tournament.name}.</p>
      </div>
      <RoyalOrangeClassicRules />
    </div>
  );
}
