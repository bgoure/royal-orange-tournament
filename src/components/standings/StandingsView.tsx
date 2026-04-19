import type { Division, Pool, PoolStanding } from "@prisma/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import {
  poolStandingsPtsCellClass,
  poolStandingsSectionTitleClass,
  poolStandingsTableHeaderClass,
} from "@/lib/pool-card-label";
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
    <div className="flex flex-col gap-4">
      {pools.map((pool) => (
        <section key={pool.id}>
          <h2
            className={`mb-3 border-b-2 pb-2 text-base font-bold md:text-lg ${poolStandingsSectionTitleClass(pool.cardLabelColor)}`}
          >
            <span className="normal-case tracking-normal">
              {pool.division.name} · {pool.name}
            </span>
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
            <div className="relative">
              <div
                className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-white to-transparent sm:hidden"
                aria-hidden
              />
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr
                      className={`text-[11px] font-bold uppercase tracking-wide ${poolStandingsTableHeaderClass(pool.cardLabelColor)}`}
                    >
                      <th className="py-3 pl-3 pr-1">Team</th>
                      <th className="px-2 py-3 text-right font-mono">W</th>
                      <th className="px-2 py-3 text-right font-mono">L</th>
                      <th className="px-2 py-3 text-right font-mono">T</th>
                      <th className="px-2 py-3 text-right font-mono">Pts</th>
                      <th className="hidden min-[421px]:table-cell px-2 py-3 text-right font-mono">RA</th>
                      <th className="hidden min-[421px]:table-cell px-2 py-3 text-right font-mono">RS</th>
                      <th className="hidden px-2 py-3 text-right font-mono sm:table-cell">RA/I</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.standings.map((s, rowIdx) => (
                      <tr
                        key={s.id}
                        className={`border-b border-zinc-200 text-zinc-700 md:hover:bg-zinc-100/80 ${
                          rowIdx % 2 === 1 ? "bg-[#f9f9f9]" : "bg-white"
                        }`}
                      >
                        <td className="py-2.5 pl-3 pr-1">
                          <span className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-zinc-900">
                            <TeamLogoMark team={s.team} sizeClass="h-6 w-6 min-h-6 min-w-6 shrink-0" />
                            <span className="min-w-0">{s.team.name}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono tabular-nums font-semibold">{s.wins}</td>
                        <td className="px-2 py-2.5 text-right font-mono tabular-nums">{s.losses}</td>
                        <td className="px-2 py-2.5 text-right font-mono tabular-nums">{s.ties}</td>
                        <td
                          className={`px-2 py-2.5 text-right font-mono tabular-nums font-bold ${poolStandingsPtsCellClass(pool.cardLabelColor)}`}
                        >
                          {s.points}
                        </td>
                        <td className="hidden min-[421px]:table-cell px-2 py-2.5 text-right font-mono tabular-nums">
                          {s.runsAgainst}
                        </td>
                        <td className="hidden min-[421px]:table-cell px-2 py-2.5 text-right font-mono tabular-nums">
                          {s.runsFor}
                        </td>
                        <td className="hidden px-2 py-2.5 text-right font-mono tabular-nums text-zinc-500 sm:table-cell">
                          {fmtRatio(s.runsAgainst, s.defensiveInnings)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
