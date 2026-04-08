import type { Division, Pool, PoolStanding, Team } from "@prisma/client";

type Row = PoolStanding & { team: Team };
type PoolWith = Pool & {
  division: Division;
  standings: Row[];
};

function fmtRatio(num: number, den: number): string {
  if (den <= 0) return "—";
  return (num / den).toFixed(3);
}

export function StandingsView({ pools }: { pools: PoolWith[] }) {
  if (pools.length === 0) {
    return <p className="text-sm text-zinc-500">No pools for this tournament.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {pools.map((pool) => (
        <section key={pool.id}>
          <h2 className="text-base font-semibold text-zinc-900">
            {pool.division.name} · {pool.name}
          </h2>
          {pool.standingsManualMode ? (
            <p className="mt-1 text-xs text-amber-800">
              Row order reflects director adjustments (for example a withdrawn team). Points and stats still
              come from recorded games.
            </p>
          ) : null}
          <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">W</th>
                  <th className="px-3 py-2 text-right">L</th>
                  <th className="px-3 py-2 text-right">T</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                  <th className="px-3 py-2 text-right">RF</th>
                  <th className="px-3 py-2 text-right">RA</th>
                  <th className="px-3 py-2 text-right">DI</th>
                  <th className="px-3 py-2 text-right">OI</th>
                  <th className="px-3 py-2 text-right">RA/DI</th>
                  <th className="px-3 py-2 text-right">RF/OI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pool.standings.map((s, idx) => (
                  <tr key={s.id} className="text-zinc-800">
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {s.team.abbreviation ?? s.team.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.losses}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.ties}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{s.points}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.runsFor}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.runsAgainst}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.defensiveInnings}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.offensiveInnings}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                      {fmtRatio(s.runsAgainst, s.defensiveInnings)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                      {fmtRatio(s.runsFor, s.offensiveInnings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
