import { GameKind } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Shared shape for public bracket-style games (playoff + consolation). */
export const publicBracketStyleGameInclude = {
  pool: { include: { division: true } },
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
      homeFromMatch: {
        select: {
          id: true,
          matchIndex: true,
          game: { select: { id: true, gameNumber: true } },
        },
      },
      awayFromMatch: {
        select: {
          id: true,
          matchIndex: true,
          game: { select: { id: true, gameNumber: true } },
        },
      },
    },
  },
  division: { select: { id: true, name: true } },
  consolationHomePool: { include: { division: true } },
  consolationAwayPool: { include: { division: true } },
} as const;

/**
 * Read surface this module is allowed to touch. Typed as read-only so a stray write
 * (repair/backfill) inside a public render path fails to compile instead of at runtime.
 */
export type BracketReadClient = { bracket: Pick<typeof prisma.bracket, "findMany"> };

export type ListBracketsOptions = { publishedOnly?: boolean };

/**
 * Read-only. Public pages render from this, so it must never write — round-grouping
 * repairs live in `repairObaRoundGroupingsForTournament` (admin action + script).
 */
export async function listBracketsForTournament(
  tournamentId: string,
  opts?: ListBracketsOptions,
  client: BracketReadClient = prisma,
) {
  return client.bracket.findMany({
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
          pool: { include: { division: true } },
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
              homeFromMatch: {
                select: {
                  id: true,
                  matchIndex: true,
                  game: { select: { id: true, gameNumber: true } },
                },
              },
              awayFromMatch: {
                select: {
                  id: true,
                  matchIndex: true,
                  game: { select: { id: true, gameNumber: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Consolation games for the public site. Only divisions whose playoff bracket is published
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
