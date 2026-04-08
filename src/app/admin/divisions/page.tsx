import { auth } from "@/auth";
import { DivisionsHierarchy } from "@/components/admin/structure/DivisionsHierarchy";
import { getTournamentStructure } from "@/lib/services/admin-structure";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminDivisionsPage() {
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

  const structure = await getTournamentStructure(tournament.id);
  if (!structure) {
    return <p className="text-sm text-zinc-500">Tournament not found.</p>;
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return <DivisionsHierarchy tournament={structure} isAdmin={isAdmin} />;
}
