import type {
  Bracket,
  BracketMatch,
  BracketRound,
  Division,
  Field,
  Game,
  Pool,
  Team,
} from "@prisma/client";

export type TeamWithPool = Team & {
  pool: (Pool & { division: Division }) | null;
  logo: { mimeType: string; updatedAt: Date } | null;
};

export type BracketMatchWithPools = BracketMatch & {
  homeSourcePool: (Pool & { division: Division }) | null;
  awaySourcePool: (Pool & { division: Division }) | null;
};

export type GameRow = Game & {
  homeTeam: TeamWithPool | null;
  awayTeam: TeamWithPool | null;
  field: Field & { location: { name: string } };
  bracketRound: BracketRound | null;
  bracketMatch: BracketMatchWithPools | null;
  division?: Pick<Division, "id" | "name"> | null;
  /** Present when `gameKind === CONSOLATION` (loaded on public consolation lists). */
  consolationHomePool?: (Pool & { division: Division }) | null;
  consolationAwayPool?: (Pool & { division: Division }) | null;
};

export type BracketWith = Bracket & {
  rounds: BracketRound[];
  games: GameRow[];
};
