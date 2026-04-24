import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BracketRoundType, GameStatus } from "@prisma/client";
import type { BracketWith } from "@/components/brackets/bracket-types";
import { resolveChampionFromBracket } from "./bracket-champion";

describe("resolveChampionFromBracket", () => {
  const base = {
    division: { id: "div1", name: "10U" },
    rounds: [
      {
        id: "r-final",
        bracketId: "br1",
        name: "Final",
        roundIndex: 1,
        roundType: BracketRoundType.FINAL,
      },
    ],
  };

  it("returns winner when final game is FINAL with score", () => {
    const bracket = {
      ...base,
      games: [
        {
          bracketRoundId: "r-final",
          bracketPosition: 0,
          status: GameStatus.FINAL,
          resultType: "REGULAR" as const,
          homeTeamId: "t-home",
          awayTeamId: "t-away",
          homeRuns: 4,
          awayRuns: 1,
          homeTeam: {
            id: "t-home",
            name: "Thunder",
            pool: null,
            logo: null,
          },
          awayTeam: {
            id: "t-away",
            name: "Lightning",
            pool: null,
            logo: null,
          },
        },
      ],
    } as unknown as BracketWith;

    const r = resolveChampionFromBracket(bracket);
    assert.equal(r?.divisionName, "10U");
    assert.equal(r?.winnerTeam.name, "Thunder");
  });

  it("returns null without a FINAL round", () => {
    const bracket = {
      division: base.division,
      rounds: [
        {
          id: "r0",
          bracketId: "br1",
          name: "Semis",
          roundIndex: 0,
          roundType: BracketRoundType.WINNERS,
        },
      ],
      games: [],
    } as unknown as BracketWith;
    assert.equal(resolveChampionFromBracket(bracket), null);
  });

  it("returns null when championship game is not FINAL", () => {
    const bracket = {
      ...base,
      games: [
        {
          bracketRoundId: "r-final",
          bracketPosition: 0,
          status: GameStatus.SCHEDULED,
          resultType: "REGULAR" as const,
          homeTeamId: "t-home",
          awayTeamId: "t-away",
          homeRuns: null,
          awayRuns: null,
          homeTeam: { id: "t-home", name: "Thunder", pool: null, logo: null },
          awayTeam: { id: "t-away", name: "Lightning", pool: null, logo: null },
        },
      ],
    } as unknown as BracketWith;
    assert.equal(resolveChampionFromBracket(bracket), null);
  });
});
