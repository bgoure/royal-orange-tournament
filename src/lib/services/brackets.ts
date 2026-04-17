import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Shared shape for public bracket-style games (playoff + friendly consolation). */
export const publicBracketStyleGameInclude = {
  homeTeam: {
    include: {
      pool: { include: { division: true } },
      logo: { select: { mimeType: true, updatedAt: true } },
    },
  },
  awayTeam: {
    include: {
      pool: { include: { division: true } },
      logo: { select: { mimeType: true, updatedAt: true } },
    },
  },
  field: { include: { location: { select: { name: true } } } },
  bracketRound: true,
  bracketMatch: {
    include: {
      homeSourcePool: { include: { division: true } },
      awaySourcePool: { include: { division: true } },
    },
  },
  division: { select: { id: true, name: true } },
  consolationHomePool: { include: { division: true } },
  consolationAwayPool: { include: { division: true } },
} as const;

export function listBracketsForTournament(
  tournamentId: string,
  opts?: { publishedOnly?: boolean },
) {
  return prisma.bracket.findMany({
    where: {
      tournamentId,
      ...(opts?.publishedOnly ? { published: true } : {}),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      division: { select: { id: true, name: true } },
      rounds: { orderBy: { roundIndex: "asc" } },
      games: {
        orderBy: [{ bracketRound: { roundIndex: "asc" } }, { bracketPosition: "asc" }],
        include: {
          homeTeam: {
            include: {
              pool: { include: { division: true } },
              logo: { select: { mimeType: true, updatedAt: true } },
            },
          },
          awayTeam: {
            include: {
              pool: { include: { division: true } },
              logo: { select: { mimeType: true, updatedAt: true } },
            },
          },
          field: { include: { location: { select: { name: true } } } },
          bracketRound: true,
          bracketMatch: {
            include: {
              homeSourcePool: { include: { division: true } },
              awaySourcePool: { include: { division: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Friendly consolation games for the public site. Only divisions whose playoff bracket is published
 * contribute rows (enforced in the query).
 */
export function listConsolationGamesForTournament(
  tournamentId: string,
  opts?: { publishedOnly?: boolean },
) {
  return prisma.game.findMany({
    where: {
      tournamentId,
      gameKind: GameKind.CONSOLATION,
      ...(opts?.publishedOnly
        ? {
            division: {
              brackets: {
                some: {
                  tournamentId,
                  published: true,
                },
              },
            },
          }
        : {}),
    },
    orderBy: { scheduledAt: "asc" },
    include: publicBracketStyleGameInclude,
  });
}
