/**
 * Build double-elimination brackets for 4–7 teams.
 * 4-team uses the classic power-of-2 DE tree.
 * 5–6 use fully feeder-wired seeded workbook maps (Round N columns, implicit byes).
 * 7 uses a feeder map with mid-bracket redraw slots.
 */

import {
  BracketFormat,
  BracketRoundType,
  BracketSlotFeedKind,
  GameKind,
  GameStatus,
  GrandFinalMode,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getObaDePreset,
  type ObaDePresetKey,
} from "@/lib/brackets/oba-de-presets";
import {
  createDivisionPlayoffBracket,
  type FirstRoundSlot,
} from "@/lib/services/bracket-division-build";
import { classicSingleElimOrder } from "@/lib/services/bracket-engine";
import { advanceByeWinnersInRound0 } from "@/lib/services/bracket-advance";

export type CreateObaDeBracketOptions = {
  tournamentId: string;
  divisionId: string;
  name: string;
  fieldId: string;
  startsAt: Date;
  hoursBetweenRounds?: number;
  /** Exact team ids for the preset (length must match preset.teamCount). Seed/draw order = array order. */
  teamIds: string[];
  presetKey: ObaDePresetKey;
  published?: boolean;
  isQualifier?: boolean;
  qualifyingTeamCount?: number;
};

type SideDef =
  | { kind: "team"; teamId: string }
  | { kind: "bye" }
  | { kind: "winner"; of: string }
  | { kind: "loser"; of: string }
  | { kind: "open" };

type GameDef = {
  key: string;
  roundName: string;
  roundType: BracketRoundType;
  /** Groups games into the same BracketRound when equal. */
  roundGroup: string;
  home: SideDef;
  away: SideDef;
  gameNumber?: string;
  /** Loser of this game drops into the named match (optional). */
  loserDropTo?: string;
};

function shuffleCopy<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Classic seeded first round: teamIds[0] = seed 1 (strongest).
 * Pads to `entrySize` with BYEs so top seeds sit out Round 1.
 * For 5 teams in an 8-slot field: seeds 1–3 bye; seed 4 vs seed 5.
 */
export function firstRoundSlotsForSeededField(
  teamIds: string[],
  entrySize: number,
): FirstRoundSlot[] {
  if (teamIds.length < 2) throw new Error("Need at least 2 teams.");
  if (teamIds.length > entrySize) {
    throw new Error(`Cannot place ${teamIds.length} teams into a ${entrySize}-slot field.`);
  }
  const order = classicSingleElimOrder(entrySize);
  const sideAt = (seedIndex: number): FirstRoundSlot["home"] => {
    if (seedIndex < teamIds.length) return { teamId: teamIds[seedIndex]! };
    return { bye: true };
  };
  const slots: FirstRoundSlot[] = [];
  const half = entrySize / 2;
  for (let m = 0; m < half; m++) {
    slots.push({
      home: sideAt(order[m * 2]!),
      away: sideAt(order[m * 2 + 1]!),
    });
  }
  return slots;
}

/** @deprecated Use firstRoundSlotsForSeededField(teamIds, 4) */
export function firstRoundSlotsForOba4(teamIds: string[]): FirstRoundSlot[] {
  if (teamIds.length !== 4) throw new Error("OBA 4-team DE requires exactly 4 teams.");
  return firstRoundSlotsForSeededField(teamIds, 4);
}

/**
 * 5-team seeded DE matching the Round 1–6 workbook layout:
 * R1 G1: 4 vs 5, G2: 2 vs 3 · R2 G3: 1 vs W1, G4: L1 vs L2 ·
 * R3 G5: W4 vs L3, G6: W2 vs W3 · R4 G7: L6 vs W5 · R5–6 championship.
 * `seeds` length 5; seeds[0] = seed 1 (strongest). Seed 1 byes Round 1.
 */
export function gamesForOba5Seeded(seeds: string[]): GameDef[] {
  const [s1, s2, s3, s4, s5] = seeds;
  if (!s1 || !s2 || !s3 || !s4 || !s5) throw new Error("5-team DE requires exactly 5 seeds.");
  return [
    {
      key: "G1",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: s4 },
      away: { kind: "team", teamId: s5 },
      gameNumber: "1",
    },
    {
      key: "G2",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: s2 },
      away: { kind: "team", teamId: s3 },
      gameNumber: "2",
    },
    {
      key: "G3",
      roundGroup: "R2",
      roundName: "Round 2",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: s1 },
      away: { kind: "winner", of: "G1" },
      gameNumber: "3",
    },
    {
      key: "G4",
      roundGroup: "R2",
      roundName: "Round 2",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "loser", of: "G1" },
      away: { kind: "loser", of: "G2" },
      gameNumber: "4",
    },
    {
      key: "G5",
      roundGroup: "R3",
      roundName: "Round 3",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "winner", of: "G4" },
      away: { kind: "loser", of: "G3" },
      gameNumber: "5",
    },
    {
      key: "G6",
      roundGroup: "R3",
      roundName: "Round 3",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "winner", of: "G2" },
      away: { kind: "winner", of: "G3" },
      gameNumber: "6",
    },
    {
      key: "G7",
      roundGroup: "R4",
      roundName: "Round 4",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "loser", of: "G6" },
      away: { kind: "winner", of: "G5" },
      gameNumber: "7",
    },
    {
      key: "GF1",
      roundGroup: "GF",
      roundName: "Championship",
      roundType: BracketRoundType.FINAL,
      home: { kind: "winner", of: "G6" },
      away: { kind: "winner", of: "G7" },
      gameNumber: "8",
    },
    {
      key: "GF2",
      roundGroup: "GF",
      roundName: "Championship",
      roundType: BracketRoundType.FINAL,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "9",
    },
  ];
}

/** Round column labels for the 5-team seeded map (for tests / UI). */
export function oba5SeededRoundColumns(): string[] {
  return ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Round 6"];
}

/**
 * 6-team seeded DE matching the Round 1–6 workbook layout:
 * R1 G1: 4 vs 5, G2: 3 vs 6 · R2 G3: 1 vs W1, G4: 2 vs W2, G5: L4 vs L1, G6: L2 vs L3 ·
 * R3 G7: W5 vs W6, G8: W3 vs W4 · R4 G9: W7 vs L8 · R5–6 championship G10/G11.
 * `seeds` length 6; seeds[0] = seed 1 (strongest). Seeds 1–2 bye Round 1 (implicit).
 */
export function gamesForOba6Seeded(seeds: string[]): GameDef[] {
  const [s1, s2, s3, s4, s5, s6] = seeds;
  if (!s1 || !s2 || !s3 || !s4 || !s5 || !s6) {
    throw new Error("6-team DE requires exactly 6 seeds.");
  }
  return [
    {
      key: "G1",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: s4 },
      away: { kind: "team", teamId: s5 },
      gameNumber: "1",
    },
    {
      key: "G2",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: s3 },
      away: { kind: "team", teamId: s6 },
      gameNumber: "2",
    },
    {
      key: "G3",
      roundGroup: "R2",
      roundName: "Round 2",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: s1 },
      away: { kind: "winner", of: "G1" },
      gameNumber: "3",
    },
    {
      key: "G4",
      roundGroup: "R2",
      roundName: "Round 2",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: s2 },
      away: { kind: "winner", of: "G2" },
      gameNumber: "4",
    },
    {
      key: "G5",
      roundGroup: "R2",
      roundName: "Round 2",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "loser", of: "G4" },
      away: { kind: "loser", of: "G1" },
      gameNumber: "5",
    },
    {
      key: "G6",
      roundGroup: "R2",
      roundName: "Round 2",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "loser", of: "G2" },
      away: { kind: "loser", of: "G3" },
      gameNumber: "6",
    },
    {
      key: "G7",
      roundGroup: "R3",
      roundName: "Round 3",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "winner", of: "G5" },
      away: { kind: "winner", of: "G6" },
      gameNumber: "7",
    },
    {
      key: "G8",
      roundGroup: "R3",
      roundName: "Round 3",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "winner", of: "G3" },
      away: { kind: "winner", of: "G4" },
      gameNumber: "8",
    },
    {
      key: "G9",
      roundGroup: "R4",
      roundName: "Round 4",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "winner", of: "G7" },
      away: { kind: "loser", of: "G8" },
      gameNumber: "9",
    },
    {
      key: "GF1",
      roundGroup: "GF",
      roundName: "Championship",
      roundType: BracketRoundType.FINAL,
      home: { kind: "winner", of: "G8" },
      away: { kind: "winner", of: "G9" },
      gameNumber: "10",
    },
    {
      key: "GF2",
      roundGroup: "GF",
      roundName: "Championship",
      roundType: BracketRoundType.FINAL,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "11",
    },
  ];
}

/** Round column labels for the 6-team seeded map (for tests / UI). */
export function oba6SeededRoundColumns(): string[] {
  return ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Round 6"];
}

function gamesForOba7(draw: string[]): GameDef[] {
  // First in draw = R1 bye (OBA: first team drawn receives the bye).
  const [bye, a, b, c, d, e, f] = draw;
  if (!bye || !a || !b || !c || !d || !e || !f) throw new Error("OBA 7-team draw incomplete.");
  return [
    {
      key: "G1",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: a },
      away: { kind: "team", teamId: b },
      gameNumber: "1",
    },
    {
      key: "G2",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: c },
      away: { kind: "team", teamId: d },
      gameNumber: "2",
    },
    {
      key: "G3",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: e },
      away: { kind: "team", teamId: f },
      gameNumber: "3",
    },
    {
      key: "G4",
      roundGroup: "R2L",
      roundName: "Round 2 · losers",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "loser", of: "G2" },
      away: { kind: "loser", of: "G3" },
      gameNumber: "4",
    },
    {
      key: "G5",
      roundGroup: "R2A",
      roundName: "Round 2 · winners",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: bye },
      away: { kind: "winner", of: "G1" },
      gameNumber: "5",
    },
    {
      key: "G6",
      roundGroup: "R2B",
      roundName: "Round 2 · winners",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "winner", of: "G2" },
      away: { kind: "winner", of: "G3" },
      gameNumber: "6",
    },
    {
      key: "G7",
      roundGroup: "R3A",
      roundName: "Round 3",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "winner", of: "G4" },
      away: { kind: "loser", of: "G1" },
      gameNumber: "7",
    },
    {
      key: "G8",
      roundGroup: "R3B",
      roundName: "Round 3",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "loser", of: "G5" },
      away: { kind: "loser", of: "G6" },
      gameNumber: "8",
    },
    {
      key: "G9",
      roundGroup: "R3W",
      roundName: "Round 3 · winners",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "winner", of: "G5" },
      away: { kind: "winner", of: "G6" },
      gameNumber: "9",
    },
    {
      key: "G10",
      roundGroup: "R4",
      roundName: "Round 4 · redraw",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "10",
    },
    {
      key: "G11",
      roundGroup: "R4",
      roundName: "Round 4 · redraw",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "11",
    },
    {
      key: "GF1",
      roundGroup: "GF",
      roundName: "Grand final",
      roundType: BracketRoundType.FINAL,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "GF1",
    },
    {
      key: "GF2",
      roundGroup: "GF",
      roundName: "Grand final",
      roundType: BracketRoundType.FINAL,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "GF2 (if necessary)",
    },
  ];
}

function gameDefsForPreset(key: ObaDePresetKey, drawOrder: string[]): GameDef[] {
  switch (key) {
    case "oba_de_5":
      return gamesForOba5Seeded(drawOrder);
    case "oba_de_6":
      return gamesForOba6Seeded(drawOrder);
    case "oba_de_7":
      return gamesForOba7(drawOrder);
    default:
      throw new Error(`Custom OBA graph not used for ${key}`);
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createFeederGraphBracket(
  opts: CreateObaDeBracketOptions,
  games: GameDef[],
  avoidRematchesUntilForced: boolean,
): Promise<string> {
  const {
    tournamentId,
    divisionId,
    name,
    fieldId,
    startsAt,
    hoursBetweenRounds = 2,
    published = false,
    presetKey,
    isQualifier = false,
    qualifyingTeamCount = 1,
  } = opts;

  const existing = await prisma.bracket.findFirst({ where: { divisionId } });
  if (existing) {
    throw new Error("This division already has a playoff bracket. Delete it before creating another.");
  }

  const field = await prisma.field.findFirst({
    where: { id: fieldId, tournamentId },
    select: { id: true },
  });
  if (!field) throw new Error("Field not found.");

  const maxOrder = await prisma.bracket.aggregate({
    where: { tournamentId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const stepMs = hoursBetweenRounds * 60 * 60 * 1000;
  const baseMs = startsAt.getTime();

  const bracketId = await prisma.$transaction(async (tx: Tx) => {
    const bracket = await tx.bracket.create({
      data: {
        tournamentId,
        divisionId,
        name,
        sortOrder,
        format: BracketFormat.DOUBLE_ELIMINATION,
        avoidRematchesUntilForced,
        grandFinalMode: GrandFinalMode.IF_NECESSARY,
        presetKey,
        published,
        isQualifier,
        qualifyingTeamCount: isQualifier ? qualifyingTeamCount : 1,
        needsResolutionRefresh: false,
      },
    });

    // Preserve workbook order of round groups.
    const groupOrder: string[] = [];
    for (const g of games) {
      if (!groupOrder.includes(g.roundGroup)) groupOrder.push(g.roundGroup);
    }

    const matchIdByKey = new Map<string, string>();
    const gameIdByKey = new Map<string, string>();

    for (let gi = 0; gi < groupOrder.length; gi++) {
      const group = groupOrder[gi]!;
      const groupGames = games.filter((g) => g.roundGroup === group);
      const sample = groupGames[0]!;
      const round = await tx.bracketRound.create({
        data: {
          bracketId: bracket.id,
          name: sample.roundName,
          roundIndex: gi,
          roundType: sample.roundType,
        },
      });
      const scheduledAt = new Date(baseMs + gi * stepMs);

      for (let mi = 0; mi < groupGames.length; mi++) {
        const def = groupGames[mi]!;
        let homeTeamId: string | null = null;
        let awayTeamId: string | null = null;
        let homeIsBye = false;
        let awayIsBye = false;
        if (def.home.kind === "team") homeTeamId = def.home.teamId;
        if (def.away.kind === "team") awayTeamId = def.away.teamId;
        if (def.home.kind === "bye") homeIsBye = true;
        if (def.away.kind === "bye") awayIsBye = true;

        const game = await tx.game.create({
          data: {
            tournamentId,
            poolId: null,
            fieldId,
            homeTeamId,
            awayTeamId,
            scheduledAt,
            schedulePlaceholder: homeTeamId == null || awayTeamId == null,
            status: GameStatus.SCHEDULED,
            resultType: "REGULAR",
            gameKind: GameKind.PLAYOFF,
            bracketId: bracket.id,
            bracketRoundId: round.id,
            bracketPosition: mi,
            gameNumber: def.gameNumber ?? def.key,
          },
        });

        const match = await tx.bracketMatch.create({
          data: {
            bracketRoundId: round.id,
            matchIndex: mi,
            gameId: game.id,
            homeIsBye,
            awayIsBye,
          },
        });
        matchIdByKey.set(def.key, match.id);
        gameIdByKey.set(def.key, game.id);
      }
    }

    // Wire explicit feeders (second pass).
    for (const def of games) {
      const matchId = matchIdByKey.get(def.key);
      if (!matchId) continue;
      const data: {
        homeFromMatchId?: string | null;
        homeFromKind?: BracketSlotFeedKind | null;
        awayFromMatchId?: string | null;
        awayFromKind?: BracketSlotFeedKind | null;
        loserDropMatchId?: string | null;
      } = {};

      if (def.home.kind === "winner" || def.home.kind === "loser") {
        const from = matchIdByKey.get(def.home.of);
        if (from) {
          data.homeFromMatchId = from;
          data.homeFromKind =
            def.home.kind === "winner" ? BracketSlotFeedKind.WINNER : BracketSlotFeedKind.LOSER;
        }
      }
      if (def.away.kind === "winner" || def.away.kind === "loser") {
        const from = matchIdByKey.get(def.away.of);
        if (from) {
          data.awayFromMatchId = from;
          data.awayFromKind =
            def.away.kind === "winner" ? BracketSlotFeedKind.WINNER : BracketSlotFeedKind.LOSER;
        }
      }
      if (def.loserDropTo) {
        data.loserDropMatchId = matchIdByKey.get(def.loserDropTo) ?? null;
      }

      if (Object.keys(data).length > 0) {
        await tx.bracketMatch.update({ where: { id: matchId }, data });
      }
    }

    return bracket.id;
  });

  await advanceByeWinnersInRound0(bracketId);
  return bracketId;
}

/**
 * Create a named DE preset bracket.
 * For seeded maps (4 / 5 / 6): teamIds[0] = seed 1 (strongest).
 * For OBA 7: teamIds order is the draw order (first = first drawn / R1 bye).
 */
export async function createObaDeBracket(opts: CreateObaDeBracketOptions): Promise<string> {
  const preset = getObaDePreset(opts.presetKey);
  if (opts.teamIds.length !== preset.teamCount) {
    throw new Error(
      `${preset.label} requires exactly ${preset.teamCount} teams (got ${opts.teamIds.length}).`,
    );
  }

  const unique = new Set(opts.teamIds);
  if (unique.size !== opts.teamIds.length) {
    throw new Error("Duplicate teams in OBA bracket draw.");
  }

  if (opts.presetKey === "oba_de_4") {
    const firstRound = firstRoundSlotsForSeededField(opts.teamIds, 4);
    return createDivisionPlayoffBracket({
      tournamentId: opts.tournamentId,
      divisionId: opts.divisionId,
      name: opts.name,
      fieldId: opts.fieldId,
      startsAt: opts.startsAt,
      hoursBetweenRounds: opts.hoursBetweenRounds,
      firstRound,
      published: opts.published,
      format: BracketFormat.DOUBLE_ELIMINATION,
      avoidRematchesUntilForced: false,
      grandFinalMode: GrandFinalMode.IF_NECESSARY,
      presetKey: opts.presetKey,
      isQualifier: opts.isQualifier,
      qualifyingTeamCount: opts.qualifyingTeamCount,
    });
  }

  const games = gameDefsForPreset(opts.presetKey, opts.teamIds);
  // Seeded 5/6 maps are fully feeder-wired; 7 still uses rematch-aware redraw slots.
  const avoid = opts.presetKey === "oba_de_7";
  return createFeederGraphBracket(opts, games, avoid);
}

/** Optional helper for tests / wizard: randomize draw order. */
export function randomizeDrawOrder(teamIds: string[], rng: () => number = Math.random): string[] {
  return shuffleCopy(teamIds, rng);
}

/**
 * Remap an existing oba_de_5 bracket to Round 1–6 workbook columns:
 * R1 G1+G2 · R2 G3+G4 · R3 G5+G6 · R4 G7 · R5–6 championship.
 * No-op when already correct. Preserves game times, teams, and feeders.
 */
export async function repairOba5RoundGrouping(bracketId: string): Promise<boolean> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { id: true, presetKey: true },
  });
  if (bracket?.presetKey !== "oba_de_5") return false;

  const games = await prisma.game.findMany({
    where: { bracketId },
    select: {
      id: true,
      gameNumber: true,
      bracketRoundId: true,
      bracketMatch: { select: { id: true } },
    },
  });

  const byNum = new Map<string, (typeof games)[number]>();
  for (const g of games) {
    const n = g.gameNumber?.trim() ?? "";
    if (n) byNum.set(n, g);
  }
  const g3 = byNum.get("3");
  const g4 = byNum.get("4");
  if (!g3 || !g4) return false;
  // Already on target layout when G3 and G4 share a round.
  if (g3.bracketRoundId && g3.bracketRoundId === g4.bracketRoundId) return false;

  type Slot = { name: string; roundType: BracketRoundType; roundIndex: number; position: number };
  const plan: Record<string, Slot> = {
    "1": { name: "Round 1", roundType: BracketRoundType.WINNERS, roundIndex: 0, position: 0 },
    "2": { name: "Round 1", roundType: BracketRoundType.WINNERS, roundIndex: 0, position: 1 },
    "3": { name: "Round 2", roundType: BracketRoundType.WINNERS, roundIndex: 1, position: 0 },
    "4": { name: "Round 2", roundType: BracketRoundType.LOSERS, roundIndex: 1, position: 1 },
    "5": { name: "Round 3", roundType: BracketRoundType.LOSERS, roundIndex: 2, position: 0 },
    "6": { name: "Round 3", roundType: BracketRoundType.WINNERS, roundIndex: 2, position: 1 },
    "7": { name: "Round 4", roundType: BracketRoundType.LOSERS, roundIndex: 3, position: 0 },
    "8": { name: "Championship", roundType: BracketRoundType.FINAL, roundIndex: 4, position: 0 },
    "9": { name: "Championship", roundType: BracketRoundType.FINAL, roundIndex: 4, position: 1 },
  };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.bracketRound.findMany({
      where: { bracketId },
      orderBy: { roundIndex: "asc" },
    });
    const claimed = new Set<string>();
    const roundIdByIndex = new Map<number, string>();

    const uniqueSlots = new Map<number, Slot>();
    for (const slot of Object.values(plan)) {
      if (!uniqueSlots.has(slot.roundIndex)) uniqueSlots.set(slot.roundIndex, slot);
    }

    for (const [roundIndex, slot] of [...uniqueSlots.entries()].sort((a, b) => a[0] - b[0])) {
      const found =
        existing.find((r) => !claimed.has(r.id) && r.roundIndex === roundIndex) ??
        existing.find((r) => !claimed.has(r.id) && r.name === slot.name) ??
        existing.find((r) => !claimed.has(r.id));
      if (found) {
        claimed.add(found.id);
        await tx.bracketRound.update({
          where: { id: found.id },
          data: {
            name: slot.name,
            roundIndex,
            roundType: slot.roundType,
          },
        });
        roundIdByIndex.set(roundIndex, found.id);
      } else {
        const created = await tx.bracketRound.create({
          data: {
            bracketId,
            name: slot.name,
            roundIndex,
            roundType: slot.roundType,
          },
        });
        claimed.add(created.id);
        roundIdByIndex.set(roundIndex, created.id);
      }
    }

    // Avoid unique (bracketRoundId, matchIndex) collisions while reshuffling.
    for (const [num, game] of byNum) {
      if (!game.bracketMatch) continue;
      const n = Number.parseInt(num, 10);
      await tx.bracketMatch.update({
        where: { id: game.bracketMatch.id },
        data: { matchIndex: 1000 + (Number.isFinite(n) ? n : 0) },
      });
    }

    const keepRoundIds = new Set(roundIdByIndex.values());

    for (const [num, slot] of Object.entries(plan)) {
      const game = byNum.get(num);
      if (!game) continue;
      const roundId = roundIdByIndex.get(slot.roundIndex)!;
      await tx.game.update({
        where: { id: game.id },
        data: { bracketRoundId: roundId, bracketPosition: slot.position },
      });
      if (game.bracketMatch) {
        await tx.bracketMatch.update({
          where: { id: game.bracketMatch.id },
          data: { bracketRoundId: roundId, matchIndex: slot.position },
        });
      }
    }

    const leftover = await tx.bracketRound.findMany({
      where: { bracketId, id: { notIn: [...keepRoundIds] } },
      select: { id: true, _count: { select: { games: true, matches: true } } },
    });
    for (const r of leftover) {
      if (r._count.games === 0 && r._count.matches === 0) {
        await tx.bracketRound.delete({ where: { id: r.id } });
      }
    }
  });

  return true;
}

/** Repair all oba_de_5 brackets in a tournament that still use the old Round 1 layout. */
export async function repairOba5RoundGroupingsForTournament(tournamentId: string): Promise<void> {
  const brackets = await prisma.bracket.findMany({
    where: { tournamentId, presetKey: "oba_de_5" },
    select: { id: true },
  });
  for (const b of brackets) {
    await repairOba5RoundGrouping(b.id);
  }
}
