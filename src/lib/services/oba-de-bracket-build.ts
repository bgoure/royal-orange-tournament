/**
 * Build OBA double-elimination brackets for 4–7 teams.
 * 4-team uses the classic power-of-2 DE tree.
 * 5–7 use feeder-driven maps aligned with the OBA workbook (fixed early games +
 * redraw / A–B endgame slots resolved at advance time).
 */

import {
  BracketFormat,
  BracketRoundType,
  BracketSlotFeedKind,
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
  /** Exact team ids for the preset (length must match preset.teamCount). Draw order = array order. */
  teamIds: string[];
  presetKey: ObaDePresetKey;
  published?: boolean;
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
 * 5-team seeded DE matching the Round 1–7 workbook layout:
 * R1 G1: 4 vs 5 · R2 G2: 2 vs 3, G3: 1 vs W1 · R3 G4: L1 vs L2 ·
 * R4 G5: W4 vs L3, G6: W2 vs W3 · R5 G7: L6 vs W5 · R6–7 championship.
 * `seeds` length 5; seeds[0] = seed 1 (strongest).
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
      roundGroup: "R2",
      roundName: "Round 2",
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
      roundGroup: "R3",
      roundName: "Round 3",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "loser", of: "G1" },
      away: { kind: "loser", of: "G2" },
      gameNumber: "4",
    },
    {
      key: "G5",
      roundGroup: "R4",
      roundName: "Round 4",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "winner", of: "G4" },
      away: { kind: "loser", of: "G3" },
      gameNumber: "5",
    },
    {
      key: "G6",
      roundGroup: "R4",
      roundName: "Round 4",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "winner", of: "G2" },
      away: { kind: "winner", of: "G3" },
      gameNumber: "6",
    },
    {
      key: "G7",
      roundGroup: "R5",
      roundName: "Round 5",
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
  return ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Round 6", "Round 7"];
}

function gamesForOba6(draw: string[]): GameDef[] {
  const [t1, t2, t3, t4, t5, t6] = draw;
  if (!t1 || !t2 || !t3 || !t4 || !t5 || !t6) throw new Error("OBA 6-team draw incomplete.");
  return [
    {
      key: "G1",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: t1 },
      away: { kind: "team", teamId: t2 },
      gameNumber: "1",
    },
    {
      key: "G2",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: t3 },
      away: { kind: "team", teamId: t4 },
      gameNumber: "2",
    },
    {
      key: "G3",
      roundGroup: "R1",
      roundName: "Round 1",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "team", teamId: t5 },
      away: { kind: "team", teamId: t6 },
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
      roundGroup: "R2M",
      roundName: "Round 2 · cross",
      roundType: BracketRoundType.LOSERS,
      home: { kind: "winner", of: "G3" },
      away: { kind: "loser", of: "G1" },
      gameNumber: "5",
    },
    {
      key: "G6",
      roundGroup: "R2W",
      roundName: "Round 2 · winners",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "winner", of: "G1" },
      away: { kind: "winner", of: "G2" },
      gameNumber: "6",
    },
    // Open redraw / branch slots (A vs B after Round 2)
    {
      key: "G7",
      roundGroup: "R3A",
      roundName: "Round 3 · branch",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "7",
    },
    {
      key: "G8",
      roundGroup: "R3A",
      roundName: "Round 3 · branch",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "8",
    },
    {
      key: "G9",
      roundGroup: "R4",
      roundName: "Round 4 · redraw",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "9",
    },
    {
      key: "G10",
      roundGroup: "R5",
      roundName: "Round 5",
      roundType: BracketRoundType.WINNERS,
      home: { kind: "open" },
      away: { kind: "open" },
      gameNumber: "10",
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
      return gamesForOba6(drawOrder);
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
  const { tournamentId, divisionId, name, fieldId, startsAt, hoursBetweenRounds = 2, published = false, presetKey } =
    opts;

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
 * For seeded classics (4 / 5): teamIds[0] = seed 1 (strongest).
 * For custom OBA maps (6 / 7): teamIds order is the draw order (first = first drawn).
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
    });
  }

  const games = gameDefsForPreset(opts.presetKey, opts.teamIds);
  // 5-team map is fully feeder-wired; 6/7 still use rematch-aware redraw slots.
  const avoid = opts.presetKey !== "oba_de_5";
  return createFeederGraphBracket(opts, games, avoid);
}

/** Optional helper for tests / wizard: randomize draw order. */
export function randomizeDrawOrder(teamIds: string[], rng: () => number = Math.random): string[] {
  return shuffleCopy(teamIds, rng);
}
