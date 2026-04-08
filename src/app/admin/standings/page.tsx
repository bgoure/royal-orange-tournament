import { auth } from "@/auth";
import { StandingsRulesAdmin } from "@/components/admin/standings/StandingsRulesAdmin";
import { getPoolsForStandingsAdmin } from "@/lib/services/admin-structure";
import { can } from "@/lib/rbac/permissions";
import { recomputePoolStandings } from "@/lib/services/standings";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminStandingsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-amber-900">No tournament selected</h1>
        <p className="mt-2 text-sm text-amber-800">
          Open the public site, choose a tournament from the switcher, then return here.
        </p>
      </div>
    );
  }

  let pools = await getPoolsForStandingsAdmin(tournament.id);
  const stale = pools.filter((p) => p.teams.length > 0 && p.standings.length === 0);
  if (stale.length > 0) {
    await Promise.all(stale.map((p) => recomputePoolStandings(p.id)));
    pools = await getPoolsForStandingsAdmin(tournament.id);
  }
  const canConfigure = session?.user?.role != null && can(session.user.role, "standings:configureRules");

  return (
    <StandingsRulesAdmin
      pools={pools}
      tournamentName={tournament.name}
      canConfigure={canConfigure}
    />
  );
}
