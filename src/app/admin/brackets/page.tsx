import { auth } from "@/auth";
import { BracketsAdmin } from "@/components/admin/brackets/BracketsAdmin";
import { formatFieldWithLocation } from "@/lib/field-display";
import { listBracketsSummary, listFieldsForBrackets, listPoolsAdvancingConfig } from "@/lib/services/admin-brackets";
import { can } from "@/lib/rbac/permissions";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminBracketsPage() {
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
      canConfigure={canConfigure}
    />
  );
}
