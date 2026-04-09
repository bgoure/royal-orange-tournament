"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Division, Pool, PoolStanding, Team } from "@prisma/client";
import {
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

export function StandingsViewWithDivisionTabs({ pools }: { pools: PoolWith[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const divisions = useMemo(() => {
    const minimal: PoolForDivisionTabs[] = pools.map((p) => ({
      id: p.id,
      name: p.name,
      division: p.division,
    }));
    return buildDivisionTabDescriptors(minimal);
  }, [pools]);

  const divisionParam = searchParams.get("division");
  const tabFromUrl = useMemo(() => {
    if (!divisionParam || divisions.length === 0) return 0;
    const i = divisions.findIndex((d) => d.id === divisionParam);
    return i >= 0 ? i : 0;
  }, [divisionParam, divisions]);

  const [tab, setTab] = useState(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const selectTab = useCallback(
    (i: number) => {
      setTab(i);
      const id = divisions[i]?.id;
      if (!id) return;
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", id);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [divisions, pathname, router, searchParams],
  );

  const visible = useMemo(() => {
    if (divisions.length === 0) return [];
    if (divisions.length <= 1) return pools;
    const id = divisions[tab]?.id;
    if (!id) return pools;
    return pools.filter((p) => gameMatchesDivisionTab({ pool: p }, id));
  }, [divisions, pools, tab]);

  if (divisions.length === 0) {
    return <StandingsView pools={[]} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {divisions.length > 1 ? (
        <div
          className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3"
          role="tablist"
          aria-label="Divisions"
        >
          {divisions.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={i === tab}
              onClick={() => selectTab(i)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === tab
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      ) : null}
      <StandingsView pools={visible} />
    </div>
  );
}
