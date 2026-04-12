"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Division, Pool, PoolStanding, Team } from "@prisma/client";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import {
  ALL_DIVISIONS_TAB_ID,
  buildDivisionTabDescriptors,
  gameMatchesDivisionTab,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";
import { StandingsView } from "@/components/standings/StandingsView";
import { DivisionTabs } from "@/components/layout/DivisionTabs";

type Row = PoolStanding & { team: Team };
type PoolWith = Pool & {
  division: Division;
  standings: Row[];
};

type TabOption = { id: string; name: string };

/** Division pills match home/schedule: All + division tabs when multiple divisions. */
export function StandingsViewWithDivisionTabs({
  pools,
  initialResolvedDivisionId,
}: {
  pools: PoolWith[];
  initialResolvedDivisionId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const divisionDescriptors = useMemo(() => {
    const minimal: PoolForDivisionTabs[] = pools.map((p) => ({
      id: p.id,
      name: p.name,
      division: p.division,
    }));
    return buildDivisionTabDescriptors(minimal);
  }, [pools]);

  const tabs: TabOption[] = useMemo(() => {
    if (divisionDescriptors.length <= 1) return [];
    return [{ id: ALL_DIVISIONS_TAB_ID, name: "All" }, ...divisionDescriptors];
  }, [divisionDescriptors]);

  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const effectiveDivisionId = useMemo(() => {
    if (tabs.length === 0) return ALL_DIVISIONS_TAB_ID;
    const param = searchParams.get("division");
    if (param && tabIds.includes(param)) return param;
    if (initialResolvedDivisionId && tabIds.includes(initialResolvedDivisionId)) {
      return initialResolvedDivisionId;
    }
    return ALL_DIVISIONS_TAB_ID;
  }, [searchParams, tabIds, tabs.length, initialResolvedDivisionId]);

  const tabIndex = useMemo(() => {
    const i = tabIds.indexOf(effectiveDivisionId);
    return i >= 0 ? i : 0;
  }, [effectiveDivisionId, tabIds]);

  const [tab, setTab] = useState(tabIndex);

  useEffect(() => {
    setTab(tabIndex);
  }, [tabIndex]);

  useEffect(() => {
    if (tabs.length <= 1) return;
    const param = searchParams.get("division");
    if (!param && effectiveDivisionId !== ALL_DIVISIONS_TAB_ID) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", effectiveDivisionId);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [tabs.length, effectiveDivisionId, pathname, router, searchParams]);

  const selectTab = useCallback(
    (i: number) => {
      const id = tabs[i]?.id;
      if (!id) return;
      setTab(i);
      startTransition(async () => {
        await setSelectedDivisionTabId(id);
        const p = new URLSearchParams(searchParams.toString());
        if (id === ALL_DIVISIONS_TAB_ID) p.delete("division");
        else p.set("division", id);
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [tabs, pathname, router, searchParams],
  );

  const activeId = tabs[tab]?.id ?? ALL_DIVISIONS_TAB_ID;
  const visible = useMemo(() => {
    if (divisionDescriptors.length === 0) return [];
    if (divisionDescriptors.length <= 1) return pools;
    if (activeId === ALL_DIVISIONS_TAB_ID) return pools;
    return pools.filter((p) => gameMatchesDivisionTab({ pool: p }, activeId));
  }, [activeId, divisionDescriptors.length, pools]);

  if (divisionDescriptors.length === 0) {
    return <StandingsView pools={[]} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <DivisionTabs tabs={tabs} activeIndex={tab} onSelect={selectTab} disabled={pending} />
      <StandingsView pools={visible} />
    </div>
  );
}
