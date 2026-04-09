"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Division, Pool, PoolStanding, Team } from "@prisma/client";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
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

  const divisions = useMemo(() => {
    const minimal: PoolForDivisionTabs[] = pools.map((p) => ({
      id: p.id,
      name: p.name,
      division: p.division,
    }));
    return buildDivisionTabDescriptors(minimal);
  }, [pools]);

  const divisionParam = searchParams.get("division");

  const effectiveId = useMemo(() => {
    if (divisions.length === 0) return "";
    if (divisionParam && divisions.some((d) => d.id === divisionParam)) return divisionParam;
    if (
      initialResolvedDivisionId &&
      divisions.some((d) => d.id === initialResolvedDivisionId)
    ) {
      return initialResolvedDivisionId;
    }
    return divisions[0]?.id ?? "";
  }, [divisionParam, divisions, initialResolvedDivisionId]);

  const tabIndex = useMemo(() => {
    const i = divisions.findIndex((d) => d.id === effectiveId);
    return i >= 0 ? i : 0;
  }, [divisions, effectiveId]);

  const [tab, setTab] = useState(tabIndex);

  useEffect(() => {
    setTab(tabIndex);
  }, [tabIndex]);

  useEffect(() => {
    if (divisions.length <= 1) return;
    if (!divisionParam && effectiveId) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", effectiveId);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [divisions.length, effectiveId, divisionParam, pathname, router, searchParams]);

  const selectTab = useCallback(
    (i: number) => {
      const id = divisions[i]?.id;
      if (!id) return;
      setTab(i);
      startTransition(async () => {
        await setSelectedDivisionTabId(id);
        const p = new URLSearchParams(searchParams.toString());
        p.set("division", id);
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      });
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
              disabled={pending}
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
