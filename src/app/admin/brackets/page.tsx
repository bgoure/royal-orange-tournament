import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { BracketsAdmin } from "@/components/admin/brackets/BracketsAdmin";
import { formatFieldWithLocation } from "@/lib/field-display";
import {
  listBracketFeederMatches,
  listBracketsSummary,
  listConsolationGamesForAdmin,
  listDivisionsForPlayoffWizard,
  listFieldsForBrackets,
  listPoolsAdvancingConfig,
} from "@/lib/services/admin-brackets";
import { listOba13PlacementBoards } from "@/lib/services/oba-de-13-placement";
import { can } from "@/lib/rbac/permissions";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function AdminBracketsPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>;
}) {
  const session = await auth();
  const tournament = await getTournamentForRequest();
  const sp = await searchParams;
  const divisionParam = typeof sp.division === "string" ? sp.division : undefined;

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [pools, fields, brackets, divisionsRaw, consolationGames, feederBrackets, oba13PlacementBoards] =
    await Promise.all([
      listPoolsAdvancingConfig(tournament.id),
      listFieldsForBrackets(tournament.id),
      listBracketsSummary(tournament.id),
      listDivisionsForPlayoffWizard(tournament.id),
      listConsolationGamesForAdmin(tournament.id),
      listBracketFeederMatches(tournament.id),
      listOba13PlacementBoards(tournament.id),
    ]);

  const divisions = divisionsRaw.map((d) => ({
    id: d.id,
    name: d.name,
    pools: d.pools.map((p) => ({
      id: p.id,
      name: p.name,
      teamCount: p._count.teams,
      teams: p.teams,
    })),
    hasBracket: d._count.brackets > 0,
  }));

  const canConfigure = session?.user?.role != null && can(session.user.role, "bracket:configure");

  const fieldOptions = fields.map((f) => ({
    id: f.id,
    label: formatFieldWithLocation(f.name, f.location.name),
  }));

  const initialDivisionId =
    divisionParam && divisions.some((d) => d.id === divisionParam)
      ? divisionParam
      : divisions[0]?.id;

  return (
    <BracketsAdmin
      pools={pools}
      divisions={divisions}
      fields={fieldOptions}
      brackets={brackets}
      consolationGames={consolationGames}
      feederBrackets={feederBrackets}
      oba13PlacementBoards={oba13PlacementBoards}
      initialDivisionId={initialDivisionId}
      tournamentName={tournament.name}
      publicSitePath={tournamentPublicBasePath(tournament)}
      tournamentTimezone={tournament.timezone}
      canConfigure={canConfigure}
    />
  );
}
