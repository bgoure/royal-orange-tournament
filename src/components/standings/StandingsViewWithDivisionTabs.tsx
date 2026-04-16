"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { Division, Pool, PoolStanding, Team } from "@prisma/client";
import { divisionValidIdsWithAll } from "@/lib/division-tab-cookie";
import {
  ALL_DIVISIONS_TAB_ID,
  buildDivisionTabDescriptors,
  gameMatchesDivisionTab,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";
import { StandingsView } from "@/components/standings/StandingsView";

type Row = PoolStanding & { team: Team };
type PoolWith = Pool & {
  division: Division;
  standings: Row[];
};

/** Division filter is controlled from the site header; this view only applies it. */
export function StandingsViewWithDivisionTabs({
  pools,
  initialResolvedDivisionId,
}: {
  pools: PoolWith[];
  initialResolvedDivisionId: string;
}) {
  const searchParams = useSearchParams();

  const divisionDescriptors = useMemo(() => {
    const minimal: PoolForDivisionTabs[] = pools.map((p) => ({
      id: p.id,
      name: p.name,
      division: p.division,
    }));
    return buildDivisionTabDescriptors(minimal);
  }, [pools]);

  const validIds = useMemo(
    () => divisionValidIdsWithAll(divisionDescriptors),
    [divisionDescriptors],
  );

  const effectiveDivisionId = useMemo(() => {
    if (divisionDescriptors.length <= 1) return ALL_DIVISIONS_TAB_ID;
    const param = searchParams.get("division") ?? undefined;
    if (param && validIds.has(param)) return param;
    if (initialResolvedDivisionId && validIds.has(initialResolvedDivisionId)) {
      return initialResolvedDivisionId;
    }
    return ALL_DIVISIONS_TAB_ID;
  }, [divisionDescriptors.length, searchParams, validIds, initialResolvedDivisionId]);

  const visible = useMemo(() => {
    if (divisionDescriptors.length === 0) return [];
    if (divisionDescriptors.length <= 1) return pools;
    if (effectiveDivisionId === ALL_DIVISIONS_TAB_ID) return pools;
    return pools.filter((p) => gameMatchesDivisionTab({ pool: p }, effectiveDivisionId));
  }, [effectiveDivisionId, divisionDescriptors.length, pools]);

  if (divisionDescriptors.length === 0) {
    return <StandingsView pools={[]} />;
  }

  return <StandingsView pools={visible} />;
}
