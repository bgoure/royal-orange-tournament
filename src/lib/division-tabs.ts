import type { Prisma } from "@prisma/client";
import type { Division, Pool } from "@prisma/client";

export const ALL_DIVISIONS_TAB_ID = "all";

export type PoolForDivisionTabs = Pick<Pool, "id" | "name"> & {
  division: Pick<Division, "id" | "name" | "sortOrder">;
};

export type DivisionTabDescriptor = {
  id: string;
  name: string;
  sortOrder: number;
};

type DivisionTabInternal = DivisionTabDescriptor & { pools: PoolForDivisionTabs[] };

function buildTabsFromDivisionIds(pools: PoolForDivisionTabs[]): DivisionTabInternal[] {
  const m = new Map<string, DivisionTabInternal>();
  for (const p of pools) {
    const d = p.division;
    const existing = m.get(d.id);
    if (existing) {
      existing.pools.push(p);
    } else {
      m.set(d.id, {
        id: d.id,
        name: d.name,
        sortOrder: d.sortOrder,
        pools: [p],
      });
    }
  }
  return [...m.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

function syntheticAgeBracketTabs(pools: PoolForDivisionTabs[]): DivisionTabInternal[] | null {
  if (pools.length < 2) return null;
  const re = /^(\d{1,2}U)\s*[·\-—.]?\s*/i;
  const bucket = new Map<string, PoolForDivisionTabs[]>();
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

export function buildDivisionTabDescriptors(pools: PoolForDivisionTabs[]): DivisionTabDescriptor[] {
  const byRealDivision = buildTabsFromDivisionIds(pools);
  if (byRealDivision.length > 1) {
    return byRealDivision.map(({ id, name, sortOrder }) => ({ id, name, sortOrder }));
  }
  const synthetic = syntheticAgeBracketTabs(pools);
  if (synthetic) {
    return synthetic.map(({ id, name, sortOrder }) => ({ id, name, sortOrder }));
  }
  return byRealDivision.map(({ id, name, sortOrder }) => ({ id, name, sortOrder }));
}

export function divisionTabGameWhere(
  divisionId: string | null | undefined,
): Prisma.GameWhereInput | undefined {
  if (!divisionId || divisionId === ALL_DIVISIONS_TAB_ID) return undefined;
  if (divisionId.startsWith("synthetic-age-")) {
    const label = divisionId.slice("synthetic-age-".length);
    const poolNameMatch: Prisma.PoolWhereInput = {
      name: {
        startsWith: label,
        mode: "insensitive",
      },
    };
    return {
      OR: [
        { pool: poolNameMatch },
        { homeTeam: { pool: poolNameMatch } },
        { awayTeam: { pool: poolNameMatch } },
        { bracketMatch: { homeSourcePool: poolNameMatch } },
        { bracketMatch: { awaySourcePool: poolNameMatch } },
      ],
    };
  }
  return {
    OR: [
      { pool: { divisionId: divisionId } },
      { homeTeam: { pool: { divisionId: divisionId } } },
      { awayTeam: { pool: { divisionId: divisionId } } },
      { bracketMatch: { homeSourcePool: { divisionId: divisionId } } },
      { bracketMatch: { awaySourcePool: { divisionId: divisionId } } },
    ],
  };
}

type PoolDiv = { name: string; division: { id: string } } | null;

export function gameMatchesDivisionTab(game: { pool: PoolDiv }, tabId: string): boolean {
  if (tabId === ALL_DIVISIONS_TAB_ID) return true;
  if (!game.pool) return false;
  if (tabId.startsWith("synthetic-age-")) {
    const label = tabId.slice("synthetic-age-".length);
    const m = game.pool.name.match(/^(\d{1,2}U)\s*[·\-—.]?\s*/i);
    return m?.[1]?.toUpperCase() === label;
  }
  return game.pool.division.id === tabId;
}

type PoolRef = { name: string; division: { id: string } };

type SourcePool = { name: string; division: { id: string } } | null;

/** Bracket game: matches tab if either team’s pool matches, round-0 placeholder pools, or both slots still TBD. */
export function bracketGameMatchesDivisionTab(
  game: {
    homeTeam: { pool: PoolRef | null } | null;
    awayTeam: { pool: PoolRef | null } | null;
    bracketMatch?: {
      homeSourcePool: SourcePool;
      awaySourcePool: SourcePool;
    } | null;
  },
  tabId: string,
): boolean {
  if (tabId === ALL_DIVISIONS_TAB_ID) return true;
  const fromTeam = (t: { pool: PoolRef | null } | null) =>
    t?.pool ? gameMatchesDivisionTab({ pool: t.pool }, tabId) : false;
  if (fromTeam(game.homeTeam) || fromTeam(game.awayTeam)) return true;
  const fromSource = (pool: SourcePool) =>
    pool ? gameMatchesDivisionTab({ pool }, tabId) : false;
  if (
    fromSource(game.bracketMatch?.homeSourcePool ?? null) ||
    fromSource(game.bracketMatch?.awaySourcePool ?? null)
  ) {
    return true;
  }
  if (!game.homeTeam && !game.awayTeam) return true;
  return false;
}
