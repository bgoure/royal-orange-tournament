import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { DivisionsHierarchy } from "@/components/admin/structure/DivisionsHierarchy";
import { getTournamentStructure } from "@/lib/services/admin-structure";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminDivisionsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const structure = await getTournamentStructure(tournament.id);
  if (!structure) {
    return <p className="text-sm text-zinc-500">Tournament not found.</p>;
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return <DivisionsHierarchy tournament={structure} isAdmin={isAdmin} />;
}
