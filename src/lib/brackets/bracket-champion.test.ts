import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BracketRoundType, GameStatus } from "@prisma/client";
import type { BracketWith } from "@/components/brackets/bracket-types";
import { resolveChampionFromBracket, shouldShowChampionCelebration } from "./bracket-champion";

describe("resolveChampionFromBracket", () => {
  it("hides congratulations when two or more teams advance", () => {
    assert.equal(shouldShowChampionCelebration({ qualifyingTeamCount: 2, isQualifier: true }), false);
    assert.equal(shouldShowChampionCelebration({ qualifyingTeamCount: 3, isQualifier: true }), false);
    assert.equal(shouldShowChampionCelebration({ qualifyingTeamCount: 1, isQualifier: true }), true);
    assert.equal(shouldShowChampionCelebration({ qualifyingTeamCount: 1, isQualifier: false }), true);
    assert.equal(shouldShowChampionCelebration(null), false);
  });

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
    assert.equal(shouldShowChampionCelebration(r), true);
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

  it("qualifier with bye seeds concludes from if-necessary FINAL (not Round-1 entrants alone)", () => {
    // Seed 1 only appears in R2 (bye); Round 1 has other teams who are later eliminated.
    const bracket = {
      division: { id: "div-aa", name: "AA" },
      format: "DOUBLE_ELIMINATION",
      isQualifier: true,
      qualifyingTeamCount: 2,
      grandFinalMode: "IF_NECESSARY",
      concludedAt: null,
      rounds: [
        {
          id: "r0",
          bracketId: "br1",
          name: "Round 1",
          roundIndex: 0,
          roundType: BracketRoundType.WINNERS,
        },
        {
          id: "r-final",
          bracketId: "br1",
          name: "Championship",
          roundIndex: 5,
          roundType: BracketRoundType.FINAL,
        },
      ],
      games: [
        {
          bracketRoundId: "r0",
          bracketPosition: 0,
          status: GameStatus.FINAL,
          resultType: "REGULAR" as const,
          homeTeamId: "t-a",
          awayTeamId: "t-b",
          homeRuns: 1,
          awayRuns: 0,
          homeTeam: { id: "t-a", name: "Early A", pool: null, logo: null },
          awayTeam: { id: "t-b", name: "Early B", pool: null, logo: null },
        },
        {
          // Undefeated home (Mets) loses GF1 → if-necessary GF2 required
          bracketRoundId: "r-final",
          bracketPosition: 0,
          status: GameStatus.FINAL,
          resultType: "REGULAR" as const,
          homeTeamId: "t-mets",
          awayTeamId: "t-twins",
          homeRuns: 3,
          awayRuns: 6,
          homeTeam: { id: "t-mets", name: "Mets", pool: null, logo: null },
          awayTeam: { id: "t-twins", name: "Twins", pool: null, logo: null },
        },
        {
          bracketRoundId: "r-final",
          bracketPosition: 1,
          status: GameStatus.FINAL,
          resultType: "REGULAR" as const,
          homeTeamId: "t-twins",
          awayTeamId: "t-mets",
          homeRuns: 16,
          awayRuns: 18,
          homeTeam: { id: "t-twins", name: "Twins", pool: null, logo: null },
          awayTeam: { id: "t-mets", name: "Mets", pool: null, logo: null },
        },
      ],
    } as unknown as BracketWith;

    const r = resolveChampionFromBracket(bracket);
    assert.ok(r);
    assert.equal(r!.isQualifier, true);
    assert.equal(r!.winnerTeam.name, "Mets");
    assert.equal(shouldShowChampionCelebration(r), false);
  });

  it("shows congratulations when a qualifier is reduced to 1 advancing team", () => {
    const bracket = {
      ...base,
      isQualifier: true,
      qualifyingTeamCount: 1,
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
    assert.equal(r?.winnerTeam.name, "Thunder");
    assert.equal(shouldShowChampionCelebration(r), true);
  });

  it("does not congratulate when qualifier teams are seeded but no scores exist", () => {
    const bracket = {
      division: { id: "div-aa", name: "AA" },
      format: "DOUBLE_ELIMINATION",
      isQualifier: true,
      qualifyingTeamCount: 2,
      grandFinalMode: "IF_NECESSARY",
      // Stale flag from a prior finish (e.g. reset forgot to clear) must not crown anyone.
      concludedAt: new Date("2026-08-08T00:00:00.000Z"),
      rounds: [
        {
          id: "r0",
          bracketId: "br1",
          name: "Round 1",
          roundIndex: 0,
          roundType: BracketRoundType.WINNERS,
        },
        {
          id: "r-final",
          bracketId: "br1",
          name: "Championship",
          roundIndex: 5,
          roundType: BracketRoundType.FINAL,
        },
      ],
      games: [
        {
          bracketRoundId: "r0",
          bracketPosition: 0,
          status: GameStatus.SCHEDULED,
          resultType: "REGULAR" as const,
          homeTeamId: "t-a",
          awayTeamId: "t-b",
          homeRuns: null,
          awayRuns: null,
          homeTeam: { id: "t-a", name: "Team A", pool: null, logo: null },
          awayTeam: { id: "t-b", name: "Team B", pool: null, logo: null },
        },
        {
          bracketRoundId: "r-final",
          bracketPosition: 0,
          status: GameStatus.SCHEDULED,
          resultType: "REGULAR" as const,
          homeTeamId: "t-mets",
          awayTeamId: null,
          homeRuns: null,
          awayRuns: null,
          homeTeam: { id: "t-mets", name: "Mets", pool: null, logo: null },
          awayTeam: null,
        },
      ],
    } as unknown as BracketWith;

    assert.equal(resolveChampionFromBracket(bracket), null);
  });
});
