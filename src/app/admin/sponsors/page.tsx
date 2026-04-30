import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { TournamentSponsorsAdmin } from "@/components/admin/tournament/TournamentSponsorsAdmin";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { listSponsorsForAdmin } from "@/lib/services/sponsors";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminSponsorsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [sponsorRows, divisions] = await Promise.all([
    listSponsorsForAdmin(tournament.id),
    prisma.division.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const sponsors = sponsorRows.map((r) => ({
    id: r.id,
    updatedAt: r.updatedAt,
    divisionIds: r.divisionAssignments.map((a) => a.divisionId),
  }));

  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-zinc-900">Sponsors</h1>
      <p className="text-sm text-zinc-600">
        Manage logos for the home page marquee ({tournament.name}). Visibility can follow the visitor’s division tab.
      </p>
      <TournamentSponsorsAdmin
        sponsors={sponsors}
        divisions={divisions}
        canManage={canManage}
        showPublicSponsorsSection={tournament.showPublicSponsorsSection}
      />
    </div>
  );
}
