/**
 * OBA RP5.2 n. bye awards (Tournament Style Rep Play-offs), as amended:
 * i. No back-to-back bye in successive rounds
 * ii. No second bye until all remaining teams have received their first
 * iii. If multiple eligible: undefeated team gets the bye
 * iv. Else RP7.3(a); RP7.3(a)(vii) is a draw when >2 teams still eligible
 *     (not Select SP bye rules, which use an immediate draw when no one is undefeated)
 */

import {
  pickTeamByObaRP73ForBye,
  type StandingsGameInput,
} from "@/lib/services/standings/standings-engine";

export type ObaByeCandidate = {
  teamId: string;
  /** Losses in this playoff bracket (0 = undefeated). */
  bracketLosses: number;
  /** Byes already received (structural R0 BYE and/or mid-round sit-outs). */
  byeCount: number;
  /** True if this team received a bye in the immediately previous pairing round. */
  hadByeInPreviousRound: boolean;
};

/**
 * Select which team receives a bye among an odd-sized pairing cohort (OBA RP5.2 n.).
 */
export function selectObaByeRecipient(
  candidates: ObaByeCandidate[],
  gamesForRp73: StandingsGameInput[],
  rng: () => number = Math.random,
): string {
  if (candidates.length === 0) {
    throw new Error("selectObaByeRecipient: no candidates");
  }
  if (candidates.length === 1) return candidates[0]!.teamId;

  // RP5.2 n.i — no back-to-back bye in successive rounds
  let pool = candidates.filter((c) => !c.hadByeInPreviousRound);
  if (pool.length === 0) {
    // Should be rare; fall back so pairing can proceed
    pool = [...candidates];
  }

  // RP5.2 n.ii — no second bye until all remaining teams have received their first
  const minByes = Math.min(...pool.map((c) => c.byeCount));
  pool = pool.filter((c) => c.byeCount === minByes);

  // RP5.2 n.iii — undefeated preferred when multiple eligible
  const undefeated = pool.filter((c) => c.bracketLosses === 0);
  if (undefeated.length > 0) {
    pool = undefeated;
  }

  if (pool.length === 1) return pool[0]!.teamId;

  // RP5.2 n.iv — RP7.3(a); (vii) = draw when >2 still tied
  return pickTeamByObaRP73ForBye(
    pool.map((c) => c.teamId),
    gamesForRp73,
    rng,
  );
}
