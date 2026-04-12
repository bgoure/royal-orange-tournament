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

function MobileStandingCard({ s, rank }: { s: Row; rank: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
            {rank}
          </span>
          <span className="font-semibold text-zinc-900">{s.team.name}</span>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-zinc-800">
          {s.points} pts
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
          <p className="font-bold tabular-nums text-emerald-800">{s.wins}</p>
          <p className="text-emerald-600">Wins</p>
        </div>
        <div className="rounded-lg bg-red-50 px-2 py-1.5">
          <p className="font-bold tabular-nums text-red-800">{s.losses}</p>
          <p className="text-red-600">Losses</p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-2 py-1.5">
          <p className="font-bold tabular-nums text-zinc-800">{s.ties}</p>
          <p className="text-zinc-500">Ties</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px] text-zinc-500">
        <div>
          <p className="tabular-nums font-medium text-zinc-700">{s.runsFor}</p>
          <p>RF</p>
        </div>
        <div>
          <p className="tabular-nums font-medium text-zinc-700">{s.runsAgainst}</p>
          <p>RA</p>
        </div>
        <div>
          <p className="tabular-nums font-medium text-zinc-700">{fmtRatio(s.runsAgainst, s.defensiveInnings)}</p>
          <p>RA/DI</p>
        </div>
        <div>
          <p className="tabular-nums font-medium text-zinc-700">{fmtRatio(s.runsFor, s.offensiveInnings)}</p>
          <p>RF/OI</p>
        </div>
      </div>
    </div>
  );
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

          {/* Mobile card view */}
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            {pool.standings.map((s, idx) => (
              <MobileStandingCard key={s.id} s={s} rank={idx + 1} />
            ))}
          </div>

          {/* Desktop table view */}
          <div className="mt-2 hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
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
                    <td className="px-3 py-2 font-medium">{s.team.name}</td>
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
