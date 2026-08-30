/**
 * Mid-bracket redraw / endgame slot resolution after OBA games finalize.
 * Seeded 4–7 workbook maps are fully feeder-wired (no-op).
 * 12-team: hide unused A/B branch after Round 5; hide if-necessary G23A when only one remains.
 * 13-team: hide unused A/B branch after Round 5; fill if-necessary G25A; hide unused R7 bye.
 */

import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { aliveTeamIds, bracketLoserTeamId, bracketWinnerTeamId } from "@/lib/services/bracket-engine";
import {
  OBA12_GAME,
  oba12EndgameBranch,
  oba12GamesForUnusedBranch,
} from "@/lib/services/oba-de-12";
import {
  OBA13_GAME,
  oba13EndgameBranch,
  oba13GamesForUnusedBranch,
} from "@/lib/services/oba-de-13";

type GameLite = {
  id: string;
  gameNumber: string | null;
  status: string;
  resultType: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeRuns: number | null;
  awayRuns: number | null;
  bracketMatch: { awayIsBye: boolean } | null;
};

function byNumber(games: GameLite[], num: string): GameLite | undefined {
  return games.find((g) => (g.gameNumber ?? "") === num);
}

async function load13Games(bracketId: string): Promise<GameLite[]> {
  return prisma.game.findMany({
    where: { bracketId },
    select: {
      id: true,
      gameNumber: true,
      status: true,
      resultType: true,
      homeTeamId: true,
      awayTeamId: true,
      homeRuns: true,
      awayRuns: true,
      bracketMatch: { select: { awayIsBye: true } },
    },
  });
}

function aliveFrom(games: GameLite[]): string[] {
  const entrants = new Set<string>();
  for (const g of games) {
    if (g.status === "CANCELLED") continue;
    if (g.homeTeamId) entrants.add(g.homeTeamId);
    if (g.awayTeamId) entrants.add(g.awayTeamId);
  }
  return aliveTeamIds({
    format: "DOUBLE_ELIMINATION",
    entrantTeamIds: [...entrants],
    games,
  });
}

async function cancelUnusedGames(games: GameLite[], numbers: readonly string[]): Promise<void> {
  const ids = games
    .filter((g) => g.gameNumber != null && numbers.includes(g.gameNumber) && g.status !== "FINAL")
    .map((g) => g.id);
  if (ids.length === 0) return;
  await prisma.game.updateMany({
    where: { id: { in: ids } },
    data: {
      status: GameStatus.CANCELLED,
      homeTeamId: null,
      awayTeamId: null,
      homeRuns: null,
      awayRuns: null,
      schedulePlaceholder: true,
    },
  });
}

async function resolveOba12(bracketId: string): Promise<void> {
  const games = await load13Games(bracketId);
  const g20 = byNumber(games, OBA12_GAME.G20);
  const g21 = byNumber(games, OBA12_GAME.G21);
  const r5Done = g20?.status === "FINAL" && g21?.status === "FINAL";

  if (r5Done) {
    const alive = aliveFrom(games);
    const branch = oba12EndgameBranch(alive.length);
    if (branch) {
      await cancelUnusedGames(games, oba12GamesForUnusedBranch(branch));
    }
  }

  const afterR5 = r5Done ? await load13Games(bracketId) : games;
  const g22a = byNumber(afterR5, OBA12_GAME.G22A);
  const g23a = byNumber(afterR5, OBA12_GAME.G23A);

  if (g22a?.status === "FINAL" && g23a && g23a.status !== "FINAL" && g23a.status !== "CANCELLED") {
    const alive = aliveFrom(afterR5);
    if (alive.length <= 1) {
      await cancelUnusedGames(afterR5, [OBA12_GAME.G23A]);
    } else if (alive.length === 2 && (!g23a.homeTeamId || !g23a.awayTeamId)) {
      const w = bracketWinnerTeamId(g22a);
      const l = bracketLoserTeamId(g22a);
      if (w && l) {
        await prisma.game.update({
          where: { id: g23a.id },
          data: {
            homeTeamId: w,
            awayTeamId: l,
            status: GameStatus.SCHEDULED,
          },
        });
      }
    }
  }
}

async function resolveOba13(bracketId: string): Promise<void> {
  const games = await load13Games(bracketId);
  const g21 = byNumber(games, OBA13_GAME.G21);
  const g22 = byNumber(games, OBA13_GAME.G22);
  const bye5 = byNumber(games, OBA13_GAME.BYE_R5);

  const r5Done =
    g21?.status === "FINAL" &&
    g22?.status === "FINAL" &&
    bye5?.status === "FINAL" &&
    Boolean(bye5.homeTeamId);

  if (r5Done) {
    const alive = aliveFrom(games);
    const branch = oba13EndgameBranch(alive.length);
    if (branch) {
      await cancelUnusedGames(games, oba13GamesForUnusedBranch(branch));
    }
  }

  const refreshed = r5Done ? await load13Games(bracketId) : games;
  const g23a = byNumber(refreshed, OBA13_GAME.G23A);
  const bye7 = byNumber(refreshed, OBA13_GAME.BYE_R7);

  if (g23a?.status === "FINAL") {
    const alive = aliveFrom(refreshed);
    if (alive.length === 2 && bye7 && bye7.status !== "FINAL") {
      await cancelUnusedGames(refreshed, [OBA13_GAME.BYE_R7]);
    }
  }

  const afterBye7 = await load13Games(bracketId);
  const g24 = byNumber(afterBye7, OBA13_GAME.G24A);
  const g25 = byNumber(afterBye7, OBA13_GAME.G25A);
  const byeR7 = byNumber(afterBye7, OBA13_GAME.BYE_R7);

  if (g24?.status === "FINAL" && g25 && g25.status !== "FINAL" && g25.status !== "CANCELLED") {
    const alive = aliveFrom(afterBye7);
    const r7ByeTeam =
      byeR7?.status === "FINAL" || byeR7?.status === "SCHEDULED" ? byeR7.homeTeamId : null;
    const bye7Live = byeR7?.status !== "CANCELLED" && Boolean(r7ByeTeam);

    if (alive.length <= 1) {
      await cancelUnusedGames(afterBye7, [OBA13_GAME.G25A]);
    } else if (alive.length === 2 && bye7Live && r7ByeTeam) {
      const w24 = bracketWinnerTeamId(g24);
      if (w24 && (!g25.homeTeamId || !g25.awayTeamId)) {
        await prisma.game.update({
          where: { id: g25.id },
          data: {
            homeTeamId: w24,
            awayTeamId: r7ByeTeam,
            status: GameStatus.SCHEDULED,
          },
        });
      }
    } else if (alive.length === 2 && !bye7Live) {
      const w = bracketWinnerTeamId(g24);
      const l = bracketLoserTeamId(g24);
      if (w && l) {
        await prisma.game.update({
          where: { id: g25.id },
          data: {
            homeTeamId: w,
            awayTeamId: l,
            status: GameStatus.SCHEDULED,
          },
        });
      }
    }
  }
}

/** After any OBA preset game finals, fill the next open redraw / endgame slots when ready. */
export async function maybeResolveObaPresetPairings(bracketId: string): Promise<void> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    select: { presetKey: true },
  });
  const key = bracket?.presetKey;
  if (!key?.startsWith("oba_de_")) return;

  if (key === "oba_de_13") {
    await resolveOba13(bracketId);
  }
  if (key === "oba_de_12") {
    await resolveOba12(bracketId);
  }
  // oba_de_5 / oba_de_6 / oba_de_7 are fully feeder-wired seeded maps (no mid-bracket redraw).
}
