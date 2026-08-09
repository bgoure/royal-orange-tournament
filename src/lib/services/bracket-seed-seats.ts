import { prisma } from "@/lib/db";

export type BracketImplicitSeedSeat = {
  gameId: string;
  gameNumber: string | null;
  /** Side that holds the pre-seeded / Round-1-bye team (not filled by a feeder). */
  side: "home" | "away";
  roundName: string;
  roundIndex: number;
  matchIndex: number;
  label: string;
  team: { id: string; name: string } | null;
};

type SeatMatchInput = {
  roundName: string;
  roundIndex: number;
  matchIndex: number;
  homeFromMatchId: string | null;
  awayFromMatchId: string | null;
  game: {
    id: string;
    gameNumber: string | null;
    homeTeam: { id: string; name: string } | null;
    awayTeam: { id: string; name: string } | null;
  } | null;
};

/** Pure: derive mid-bracket bye-seed seats from feeder wiring (exactly one side fed). */
export function deriveImplicitSeedSeats(matches: SeatMatchInput[]): BracketImplicitSeedSeat[] {
  const seats: Omit<BracketImplicitSeedSeat, "label">[] = [];
  for (const match of matches) {
    if (!match.game) continue;
    if (match.roundIndex <= 0) continue;
    const homeFed = match.homeFromMatchId != null;
    const awayFed = match.awayFromMatchId != null;
    // Exactly one feeder ⇒ the other seat is an implicit seed / bye-in.
    if (homeFed === awayFed) continue;
    const side: "home" | "away" = homeFed ? "away" : "home";
    const team = side === "home" ? match.game.homeTeam : match.game.awayTeam;
    seats.push({
      gameId: match.game.id,
      gameNumber: match.game.gameNumber,
      side,
      roundName: match.roundName,
      roundIndex: match.roundIndex,
      matchIndex: match.matchIndex,
      team,
    });
  }

  seats.sort((a, b) => {
    if (a.roundIndex !== b.roundIndex) return a.roundIndex - b.roundIndex;
    const ga = Number.parseInt(a.gameNumber ?? "", 10);
    const gb = Number.parseInt(b.gameNumber ?? "", 10);
    if (Number.isFinite(ga) && Number.isFinite(gb) && ga !== gb) return ga - gb;
    if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
    return a.side === "home" ? -1 : 1;
  });

  return seats.map((s, i) => {
    const gLabel =
      s.gameNumber && s.gameNumber.trim() !== "" ? `G${s.gameNumber}` : `match ${s.matchIndex + 1}`;
    return {
      ...s,
      label: `Seed ${i + 1} → ${gLabel} (${s.roundName})`,
    };
  });
}

/**
 * Later-round seats that are not filled by a feeder (exactly one of home/away is wired).
 * Covers OBA 5–7 and any custom/classic map with the same feeder shape.
 */
export async function listBracketImplicitSeedSeats(
  bracketId: string,
): Promise<BracketImplicitSeedSeat[]> {
  const rounds = await prisma.bracketRound.findMany({
    where: { bracketId, roundIndex: { gt: 0 } },
    orderBy: { roundIndex: "asc" },
    select: {
      name: true,
      roundIndex: true,
      matches: {
        orderBy: { matchIndex: "asc" },
        select: {
          matchIndex: true,
          homeFromMatchId: true,
          awayFromMatchId: true,
          game: {
            select: {
              id: true,
              gameNumber: true,
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return deriveImplicitSeedSeats(
    rounds.flatMap((round) =>
      round.matches.map((match) => ({
        roundName: round.name,
        roundIndex: round.roundIndex,
        matchIndex: match.matchIndex,
        homeFromMatchId: match.homeFromMatchId,
        awayFromMatchId: match.awayFromMatchId,
        game: match.game,
      })),
    ),
  );
}

/** Write ordered bye-seed teams onto discovered seats (one side only; feeder side stays TBD). */
export async function placeTeamsOnImplicitSeedSeats(
  seats: BracketImplicitSeedSeat[],
  teamIds: string[],
  tx: {
    game: {
      update: (args: {
        where: { id: string };
        data: { homeTeamId?: string | null; awayTeamId?: string | null };
      }) => Promise<unknown>;
    };
  },
): Promise<void> {
  if (seats.length !== teamIds.length) {
    throw new Error(
      `Expected ${seats.length} Round 1 bye seed(s), got ${teamIds.length}.`,
    );
  }
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]!;
    const teamId = teamIds[i]!;
    await tx.game.update({
      where: { id: seat.gameId },
      data: seat.side === "home" ? { homeTeamId: teamId } : { awayTeamId: teamId },
    });
  }
}
