import type { Tournament } from "@prisma/client";
import { RoyalOrangeClassicRules } from "@/components/content/RoyalOrangeClassicRules";
import { PageTitle } from "@/components/ui/PublicHeading";

export async function TournamentRulesPublic({ tournament }: { tournament: Tournament }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Rules and Resources</PageTitle>
      </div>
      <RoyalOrangeClassicRules tournamentName={tournament.name} />
    </div>
  );
}
