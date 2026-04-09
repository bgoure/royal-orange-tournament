import { Suspense } from "react";
import { StandingsViewWithDivisionTabs } from "@/components/standings/StandingsViewWithDivisionTabs";
import { listPoolsWithStandings } from "@/lib/services/pools";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function StandingsPage() {
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const pools = await listPoolsWithStandings(tournament.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Standings</h1>
        <p className="text-sm text-zinc-600">
          Points: 2 win, 1 tie, 0 loss. Tiebreakers follow published pool rules.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-zinc-100/80" aria-hidden="true" />
        }
      >
        <StandingsViewWithDivisionTabs pools={pools} />
      </Suspense>
    </div>
  );
}
