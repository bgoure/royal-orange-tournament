/**
 * Pure client-side state helpers for PoolAssignmentBoard (no React / DB).
 */

export const UNASSIGNED = "__unassigned__" as const;

export type PoolAssignmentMap = Record<string, string>; // teamId -> poolId | UNASSIGNED

export type PoolBoardPool = {
  id: string;
  name: string;
  /** Soft capacity hint (e.g. balanced target). Not enforced by the DB. */
  capacityHint: number | null;
};

export type PoolBoardTeam = {
  id: string;
  name: string;
  poolId: string;
};

export type PoolBoardIssue = {
  kind: "duplicate" | "unassigned" | "empty_pool" | "over_capacity";
  message: string;
  poolId?: string;
  teamId?: string;
};

export function initialPlacement(teams: readonly PoolBoardTeam[]): PoolAssignmentMap {
  const map: PoolAssignmentMap = {};
  for (const t of teams) map[t.id] = t.poolId;
  return map;
}

export function placementsEqual(a: PoolAssignmentMap, b: PoolAssignmentMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? UNASSIGNED) !== (b[k] ?? UNASSIGNED)) return false;
  }
  return true;
}

export function moveTeamToPool(
  placement: PoolAssignmentMap,
  teamId: string,
  poolId: string,
): PoolAssignmentMap {
  return { ...placement, [teamId]: poolId };
}

export function balancedCapacityHint(teamCount: number, poolCount: number): number | null {
  if (poolCount <= 0) return null;
  return Math.ceil(teamCount / poolCount);
}

export function validatePoolPlacement(
  placement: PoolAssignmentMap,
  teams: readonly PoolBoardTeam[],
  pools: readonly PoolBoardPool[],
): PoolBoardIssue[] {
  const issues: PoolBoardIssue[] = [];
  const poolIds = new Set(pools.map((p) => p.id));
  const seen = new Set<string>();

  for (const t of teams) {
    const dest = placement[t.id] ?? UNASSIGNED;
    if (seen.has(t.id)) {
      issues.push({
        kind: "duplicate",
        teamId: t.id,
        message: `Team “${t.name}” appears more than once.`,
      });
    }
    seen.add(t.id);

    if (dest === UNASSIGNED) {
      issues.push({
        kind: "unassigned",
        teamId: t.id,
        message: `“${t.name}” must be assigned to a pool before saving.`,
      });
      continue;
    }
    if (!poolIds.has(dest)) {
      issues.push({
        kind: "unassigned",
        teamId: t.id,
        message: `“${t.name}” targets an unknown pool.`,
      });
    }
  }

  for (const pool of pools) {
    const count = teams.filter((t) => (placement[t.id] ?? UNASSIGNED) === pool.id).length;
    if (count === 0 && teams.length > 0) {
      issues.push({
        kind: "empty_pool",
        poolId: pool.id,
        message: `Pool “${pool.name}” has no teams.`,
      });
    }
    if (pool.capacityHint != null && count > pool.capacityHint) {
      issues.push({
        kind: "over_capacity",
        poolId: pool.id,
        message: `Pool “${pool.name}” has ${count} teams (balanced target ${pool.capacityHint}).`,
      });
    }
  }

  return issues;
}

/** Assignments that differ from the server baseline (for the save payload). */
export function changedAssignments(
  baseline: PoolAssignmentMap,
  current: PoolAssignmentMap,
  teams: readonly PoolBoardTeam[],
): { teamId: string; poolId: string }[] {
  const out: { teamId: string; poolId: string }[] = [];
  for (const t of teams) {
    const next = current[t.id];
    if (!next || next === UNASSIGNED) continue;
    if (next !== (baseline[t.id] ?? t.poolId)) {
      out.push({ teamId: t.id, poolId: next });
    }
  }
  return out;
}
