"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Division, Pool, PoolStanding, Team } from "@prisma/client";
import { StandingsView } from "@/components/standings/StandingsView";

type Row = PoolStanding & { team: Team };
type PoolWith = Pool & {
  division: Division;
  standings: Row[];
};

type DivisionTab = {
  id: string;
  name: string;
  sortOrder: number;
  pools: PoolWith[];
};

function buildTabsFromDivisionIds(pools: PoolWith[]): DivisionTab[] {
  const m = new Map<string, DivisionTab>();
  for (const p of pools) {
    const d = p.division;
    const existing = m.get(d.id);
    if (existing) {
      existing.pools.push(p);
    } else {
      m.set(d.id, { id: d.id, name: d.name, sortOrder: d.sortOrder, pools: [p] });
    }
  }
  return [...m.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

/** When all pools sit under one division row but pool names start with "10U · …", "11U · …", etc. */
function syntheticAgeBracketTabs(pools: PoolWith[]): DivisionTab[] | null {
  if (pools.length < 2) return null;
  const re = /^(\d{1,2}U)\s*[·\-—.]?\s*/i;
  const bucket = new Map<string, PoolWith[]>();
  for (const p of pools) {
    const m = p.name.match(re);
    if (!m) return null;
    const key = m[1]!.toUpperCase();
    const list = bucket.get(key) ?? [];
    list.push(p);
    bucket.set(key, list);
  }
  if (bucket.size <= 1) return null;
  return [...bucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name], i) => ({
      id: `synthetic-age-${name}`,
      name,
      sortOrder: i,
      pools: bucket.get(name)!,
    }));
}

function buildStandingsTabs(pools: PoolWith[]): DivisionTab[] {
  const byRealDivision = buildTabsFromDivisionIds(pools);
  if (byRealDivision.length > 1) return byRealDivision;
  const synthetic = syntheticAgeBracketTabs(pools);
  return synthetic ?? byRealDivision;
}

export function StandingsViewWithDivisionTabs({ pools }: { pools: PoolWith[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const divisions = useMemo(() => buildStandingsTabs(pools), [pools]);

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

  if (divisions.length === 0) {
    return <StandingsView pools={[]} />;
  }

  const visible = divisions[tab]?.pools ?? [];

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
