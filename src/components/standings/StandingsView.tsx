import type { Division, Pool, PoolStanding } from "@prisma/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import type { TeamWithPublicLogo } from "@/lib/team-logo";

type Row = PoolStanding & { team: TeamWithPublicLogo };
type PoolWith = Pool & {
  division: Division;
  standings: Row[];
};

function fmtRatio(num: number, den: number): string {
  if (den <= 0) return "—";
  return (num / den).toFixed(2);
}

export function StandingsView({ pools }: { pools: PoolWith[] }) {
  if (pools.length === 0) {
    return (
      <EmptyState
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path d="M8 21V16M12 21V10M16 21V4" />
          </svg>
        }
        title="No divisions or pools yet"
        description="Standings will appear after teams and pools are set up in the tournament."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {pools.map((pool) => (
        <section key={pool.id}>
          <h2 className="mb-1 text-sm font-bold text-zinc-900">
            {pool.division.name} · {pool.name}
          </h2>
          {pool.standingsManualMode ? (
            <p className="mb-2 text-[11px] text-amber-700">
              Order reflects director adjustments.
            </p>
          ) : null}

          {pool.standings.length === 0 ? (
            <EmptyState
              className="py-8"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
              }
              title="No teams in this pool yet"
              description="Teams will show here once assigned to this division pool."
            />
          ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pl-3 pr-1">Team</th>
                  <th className="px-1.5 py-2 text-center">W</th>
                  <th className="px-1.5 py-2 text-center">L</th>
                  <th className="px-1.5 py-2 text-center">T</th>
                  <th className="px-1.5 py-2 text-center">Pts</th>
                  <th className="px-1.5 py-2 text-center">RA</th>
                  <th className="px-1.5 py-2 text-center">RS</th>
                  <th className="hidden px-1.5 py-2 text-center sm:table-cell">RA/I</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pool.standings.map((s) => (
                  <tr key={s.id} className="text-zinc-700">
                    <td className="py-2.5 pl-3 pr-1">
                      <span className="inline-flex min-w-0 items-center gap-2 font-medium text-zinc-900">
                        <TeamLogoMark team={s.team} />
                        <span className="min-w-0">{s.team.name}</span>
                      </span>
                    </td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums font-semibold">{s.wins}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{s.losses}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{s.ties}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums font-bold text-royal">{s.points}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{s.runsAgainst}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums">{s.runsFor}</td>
                    <td className="hidden px-1.5 py-2.5 text-center tabular-nums text-zinc-500 sm:table-cell">
                      {fmtRatio(s.runsAgainst, s.defensiveInnings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      ))}
    </div>
  );
}
