import { BracketsView } from "@/components/brackets/BracketsView";
import { listBracketsForTournament } from "@/lib/services/brackets";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function BracketsPage() {
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const brackets = await listBracketsForTournament(tournament.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Brackets</h1>
        <p className="text-sm text-zinc-600">Playoff rounds and scheduled games.</p>
      </div>
      <BracketsView brackets={brackets} />
    </div>
  );
}
