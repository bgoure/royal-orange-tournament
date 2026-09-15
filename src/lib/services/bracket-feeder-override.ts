/**
 * Pure Games → Teams (override) ack rules for derived winner/loser feeder seats.
 * Kept out of `components/brackets` so Server Actions can import it.
 */

export type FeederOverrideSeat = {
  gameNumber: string | null;
  matchIndex: number;
  kind: string | null;
};

export type FeederOverrideAckInput = {
  isSitOut: boolean;
  currentHomeTeamId: string | null;
  currentAwayTeamId: string | null;
  nextHomeTeamId: string | null;
  nextAwayTeamId: string | null;
  homeFeeder: FeederOverrideSeat | null;
  awayFeeder: FeederOverrideSeat | null;
  gameLocked: boolean;
};

export type FeederOverrideAck = {
  needsAck: true;
  message: string;
};

export function formatFeederGameLabel(gameNumber: string | null, matchIndex: number): string {
  const n = gameNumber?.trim();
  if (n) {
    if (/bye/i.test(n)) return n;
    return `G${n}`;
  }
  return `Match ${matchIndex + 1}`;
}

export function formatFeederOutcome(kind: string | null | undefined): "Winner" | "Loser" {
  return kind === "LOSER" ? "Loser" : "Winner";
}

/** e.g. "Away is G12 Winner". Null when the side is not match-feeder-derived. */
export function formatFeederSeatLabel(
  side: "Home" | "Away",
  feeder: FeederOverrideSeat | null,
): string | null {
  if (!feeder) return null;
  return `${side} is ${formatFeederGameLabel(feeder.gameNumber, feeder.matchIndex)} ${formatFeederOutcome(feeder.kind)}`;
}

function idsEqual(a: string | null, b: string | null): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Whether a team-override save must stop for a named confirmation.
 * Sit-outs never require this ack. Feeder-side team changes and live/scored
 * target games do (same message when both apply).
 */
export function evaluateFeederOverrideAck(input: FeederOverrideAckInput): FeederOverrideAck | null {
  if (input.isSitOut) return null;

  const homeChanged = !idsEqual(input.currentHomeTeamId, input.nextHomeTeamId);
  const awayChanged = !idsEqual(input.currentAwayTeamId, input.nextAwayTeamId);
  if (!homeChanged && !awayChanged) return null;

  const feederParts: string[] = [];
  if (awayChanged) {
    const label = formatFeederSeatLabel("Away", input.awayFeeder);
    if (label) feederParts.push(label);
  }
  if (homeChanged) {
    const label = formatFeederSeatLabel("Home", input.homeFeeder);
    if (label) feederParts.push(label);
  }

  if (feederParts.length === 0 && !input.gameLocked) return null;

  const bits: string[] = [];
  if (feederParts.length === 1) {
    bits.push(`${feederParts[0]}. Saving will replace that feeder result.`);
  } else if (feederParts.length > 1) {
    bits.push(`${feederParts.join(" and ")}. Saving will replace those feeder results.`);
  }
  if (input.gameLocked) {
    bits.push("This game is live or already scored.");
  }
  bits.push("Check the box, then save again.");
  return { needsAck: true, message: bits.join(" ") };
}
