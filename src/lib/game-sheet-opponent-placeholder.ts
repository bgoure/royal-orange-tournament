import { BracketRoundType, GameKind } from "@prisma/client";

export type GameSheetBracketRoundPick = {
  name: string;
  roundType: BracketRoundType;
};

/** Label for an unfilled home/away slot on printable game sheets (playoff / consolation). */
export function gameSheetOpponentPlaceholder(input: {
  gameKind: GameKind;
  bracketRound: GameSheetBracketRoundPick | null;
}): string {
  if (input.gameKind === GameKind.POOL) return "TBD";
  if (input.gameKind === GameKind.CONSOLATION) return "Consolation Game";

  const br = input.bracketRound;
  if (!br) return "Playoff Game";

  if (br.roundType === BracketRoundType.FINAL) return "Championship Game";

  const key = br.name.trim().toLowerCase();
  if (key === "final") return "Championship Game";
  if (key === "semifinals") return "Semi-Final Game";
  if (key === "quarterfinals") return "Quarter-Final Game";

  if (br.roundType === BracketRoundType.LOSERS) {
    const label = br.name.trim();
    return label ? `${label} Game` : "Playoff Game";
  }

  const label = br.name.trim();
  return label ? `${label} Game` : "Playoff Game";
}
