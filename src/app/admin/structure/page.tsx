import { auth } from "@/auth";
import Link from "next/link";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { StructureOverview } from "@/components/admin/structure/StructureOverview";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminStructurePage({
  searchParams,
}: {
  searchParams: Promise<{ builder?: string }>;
}) {
  const session = await auth();
  const tournament = await getTournamentForRequest();
  const sp = await searchParams;

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const divisions = await prisma.division.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { sortOrder: "asc" },
    include: {
      pools: {
        orderBy: { sortOrder: "asc" },
        include: {
          teams: { orderBy: [{ seed: "asc" }, { name: "asc" }], select: { id: true, name: true } },
        },
      },
      brackets: {
        take: 1,
        select: {
          id: true,
          name: true,
          format: true,
          published: true,
          avoidRematchesUntilForced: true,
          _count: { select: { games: true, rounds: true } },
        },
      },
    },
  });

  const canConfigure =
    session?.user?.role != null && can(session.user.role, "bracket:configure");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Structure</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournament.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/brackets"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Brackets
          </Link>
          <Link
            href="/admin/tournament-settings"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Settings (venue & schedule)
          </Link>
        </div>
      </header>

      {sp.builder === "1" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Custom bracket mode: refine Round 1 seeds and tree under{" "}
          <Link href="/admin/brackets" className="font-semibold underline">
            Brackets
          </Link>
          . A full visual bracket builder is coming next — for now use the playoff wizard and Games to
          place teams.
        </div>
      ) : null}

      <StructureOverview
        divisions={divisions.map((d) => ({
          id: d.id,
          name: d.name,
          pools: d.pools.map((p) => ({
            id: p.id,
            name: p.name,
            teams: p.teams,
          })),
          bracket: d.brackets[0]
            ? {
                id: d.brackets[0].id,
                name: d.brackets[0].name,
                format: d.brackets[0].format,
                published: d.brackets[0].published,
                avoidRematchesUntilForced: d.brackets[0].avoidRematchesUntilForced,
                rounds: d.brackets[0]._count.rounds,
                games: d.brackets[0]._count.games,
              }
            : null,
        }))}
        canConfigure={canConfigure}
      />
    </div>
  );
}
