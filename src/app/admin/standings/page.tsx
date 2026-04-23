import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { StandingsRulesAdmin } from "@/components/admin/standings/StandingsRulesAdmin";
import { getPoolsForStandingsAdmin } from "@/lib/services/admin-structure";
import { can } from "@/lib/rbac/permissions";
import { recomputePoolStandings } from "@/lib/services/standings";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function AdminStandingsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
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
      publicSitePath={tournamentPublicBasePath(tournament)}
      canConfigure={canConfigure}
    />
  );
}
