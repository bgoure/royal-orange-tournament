import Link from "next/link";
import { RoyalOrangeClassicRules } from "@/components/content/RoyalOrangeClassicRules";
import { PageTitle } from "@/components/ui/PublicHeading";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { tournamentPath } from "@/lib/tournament-public-path";

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
        <p className="mt-2 text-sm text-zinc-600">
          Tournament rules for {tournament.name}. Constitution and playing rules of the O.B.A. apply except as noted
          below.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href={tournamentPath(tournamentSlug, "locations")}
            className="font-medium text-royal underline-offset-2 hover:underline"
          >
            Venues &amp; tournament headquarters →
          </Link>
        </p>
      </div>
      <RoyalOrangeClassicRules />
    </div>
  );
}
