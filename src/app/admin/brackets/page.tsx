import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { BracketsAdmin } from "@/components/admin/brackets/BracketsAdmin";
import { formatFieldWithLocation } from "@/lib/field-display";
import { listBracketsSummary, listFieldsForBrackets, listPoolsAdvancingConfig } from "@/lib/services/admin-brackets";
import { can } from "@/lib/rbac/permissions";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminBracketsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [pools, fields, brackets] = await Promise.all([
    listPoolsAdvancingConfig(tournament.id),
    listFieldsForBrackets(tournament.id),
    listBracketsSummary(tournament.id),
  ]);

  const canConfigure = session?.user?.role != null && can(session.user.role, "bracket:configure");

  const fieldOptions = fields.map((f) => ({
    id: f.id,
    label: formatFieldWithLocation(f.name, f.location.name),
  }));

  return (
    <BracketsAdmin
      pools={pools}
      fields={fieldOptions}
      brackets={brackets}
      tournamentName={tournament.name}
      tournamentSlug={tournament.slug}
      tournamentTimezone={tournament.timezone}
      canConfigure={canConfigure}
    />
  );
}
