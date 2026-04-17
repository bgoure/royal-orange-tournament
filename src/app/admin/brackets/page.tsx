import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { BracketsAdmin } from "@/components/admin/brackets/BracketsAdmin";
import { formatFieldWithLocation } from "@/lib/field-display";
import {
  listBracketsSummary,
  listDivisionsForPlayoffWizard,
  listFieldsForBrackets,
  listPoolsAdvancingConfig,
} from "@/lib/services/admin-brackets";
import { can } from "@/lib/rbac/permissions";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminBracketsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [pools, fields, brackets, divisionsRaw] = await Promise.all([
    listPoolsAdvancingConfig(tournament.id),
    listFieldsForBrackets(tournament.id),
    listBracketsSummary(tournament.id),
    listDivisionsForPlayoffWizard(tournament.id),
  ]);

  const divisions = divisionsRaw.map((d) => ({
    id: d.id,
    name: d.name,
    pools: d.pools.map((p) => ({
      id: p.id,
      name: p.name,
      teamCount: p._count.teams,
    })),
    hasBracket: d._count.brackets > 0,
  }));

  const canConfigure = session?.user?.role != null && can(session.user.role, "bracket:configure");

  const fieldOptions = fields.map((f) => ({
    id: f.id,
    label: formatFieldWithLocation(f.name, f.location.name),
  }));

  return (
    <BracketsAdmin
      pools={pools}
      divisions={divisions}
      fields={fieldOptions}
      brackets={brackets}
      tournamentName={tournament.name}
      tournamentSlug={tournament.slug}
      tournamentTimezone={tournament.timezone}
      canConfigure={canConfigure}
    />
  );
}
