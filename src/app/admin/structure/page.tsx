import Link from "next/link";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import {
  StructureOverview,
  type StructureSeedBoard,
} from "@/components/admin/structure/StructureOverview";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { listBracketImplicitSeedSeats } from "@/lib/services/bracket-seed-seats";
import { loadAdminPageTournament } from "@/lib/rbac/tenant-access";
import type { SeedBoardSide } from "@/components/admin/structure/BracketSeedBoard";

export const dynamic = "force-dynamic";

function toSide(
  isBye: boolean,
  team: { id: string; name: string } | null | undefined,
): SeedBoardSide {
  if (isBye) return { kind: "bye" };
  if (team) return { kind: "team", teamId: team.id, name: team.name };
  return { kind: "empty" };
}

export default async function AdminStructurePage({
  searchParams,
}: {
  searchParams: Promise<{ builder?: string }>;
}) {
  const { session, tournament } = await loadAdminPageTournament();
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
          presetKey: true,
          _count: { select: { games: true, rounds: true } },
          rounds: {
            where: { roundIndex: 0 },
            take: 1,
            include: {
              matches: {
                orderBy: { matchIndex: "asc" },
                include: {
                  game: {
                    select: {
                      status: true,
                      resultType: true,
                      homeTeam: { select: { id: true, name: true } },
                      awayTeam: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const canConfigure =
    session?.user?.role != null && can(session.user.role, "bracket:configure");

  const openBuilder = sp.builder === "1";

  const divisionRows = await Promise.all(
    divisions.map(async (d) => {
      const b = d.brackets[0] ?? null;
      const round0 = b?.rounds[0] ?? null;
      const allTeams = d.pools.flatMap((p) => p.teams);
      let seedBoard: StructureSeedBoard | null = null;
      if (b && round0 && round0.matches.length > 0) {
        const seedSeats = await listBracketImplicitSeedSeats(b.id);
        seedBoard = {
          bracketId: b.id,
          bracketName: b.name,
          presetKey: b.presetKey,
          teams: allTeams,
          byeSeedSeats: seedSeats.map((s) => ({
            label: s.label,
            team: s.team,
          })),
          matches: round0.matches.map((m) => {
            const g = m.game;
            const locked =
              g?.status === "LIVE" ||
              (g?.status === "FINAL" && g.resultType === "REGULAR");
            return {
              matchId: m.id,
              matchIndex: m.matchIndex,
              home: toSide(m.homeIsBye, m.game?.homeTeam),
              away: toSide(m.awayIsBye, m.game?.awayTeam),
              locked,
            };
          }),
        };
      }
      return {
        id: d.id,
        name: d.name,
        pools: d.pools.map((p) => ({
          id: p.id,
          name: p.name,
          teams: p.teams,
        })),
        bracket: b
          ? {
              id: b.id,
              name: b.name,
              format: b.format,
              published: b.published,
              avoidRematchesUntilForced: b.avoidRematchesUntilForced,
              rounds: b._count.rounds,
              games: b._count.games,
            }
          : null,
        seedBoard,
      };
    }),
  );

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

      {openBuilder ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Custom create: teams are ready, but no template bracket was built. Create a playoff under{" "}
          <Link href="/admin/brackets" className="font-semibold underline">
            Brackets
          </Link>
          , then use the Round 1 seed board here to place teams and BYEs.
        </div>
      ) : null}

      <StructureOverview
        key={tournament.id}
        openBuilder={openBuilder}
        divisions={divisionRows}
        canConfigure={canConfigure}
      />
    </div>
  );
}
