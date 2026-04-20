import type { Division, Pool, PoolStanding } from "@prisma/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { StandingsPoolTable } from "@/components/standings/StandingsPoolTable";
import { poolStandingsColorByPoolIndex, poolStandingsSectionTitleClass } from "@/lib/pool-card-label";
import type { TeamWithPublicLogo } from "@/lib/team-logo";

type Row = PoolStanding & { team: TeamWithPublicLogo };
type PoolWith = Pool & {
  division: Division;
  standings: Row[];
};

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
      {pools.map((pool, poolIdx) => {
        const standingsColor = poolStandingsColorByPoolIndex(poolIdx);
        return (
          <section key={pool.id}>
            <h2
              className={`mb-3 border-b-2 pb-2 text-base font-bold md:text-lg ${poolStandingsSectionTitleClass(standingsColor)}`}
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
              <StandingsPoolTable pool={pool} standingsColor={standingsColor} />
            )}
          </section>
        );
      })}
    </div>
  );
}
