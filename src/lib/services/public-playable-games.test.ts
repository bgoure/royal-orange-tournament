import "dotenv/config";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  BracketFormat,
  BracketRoundType,
  BracketSlotFeedKind,
  GameKind,
  GameStatus,
} from "@prisma/client";
import {
  isPublicPlayableGame,
  publicPlayableGameClause,
} from "@/lib/services/public-playable-games";

// ---------------------------------------------------------------------------
// Unit tests — no database needed, always run
// ---------------------------------------------------------------------------

describe("isPublicPlayableGame", () => {
  it("treats pool games without a bracket match as playable", () => {
    assert.equal(isPublicPlayableGame({ bracketMatch: null }), true);
  });

  it("hides games linked to a structural home or away bye", () => {
    assert.equal(isPublicPlayableGame({ bracketMatch: { homeIsBye: true, awayIsBye: false } }), false);
    assert.equal(isPublicPlayableGame({ bracketMatch: { homeIsBye: false, awayIsBye: true } }), false);
    assert.equal(isPublicPlayableGame({ bracketMatch: { homeIsBye: true, awayIsBye: true } }), false);
  });

  it("keeps legitimate feeder and TBD bracket slots visible", () => {
    assert.equal(isPublicPlayableGame({ bracketMatch: { homeIsBye: false, awayIsBye: false } }), true);
  });
});

describe("publicPlayableGameClause", () => {
  it("excludes bracket matches with either bye flag", () => {
    const clause = publicPlayableGameClause();
    assert.deepEqual(clause, {
      NOT: {
        bracketMatch: {
          is: {
            OR: [{ homeIsBye: true }, { awayIsBye: true }],
          },
        },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test bootstrap — requires TEST_DATABASE_URL pointing at a
// clearly disposable local database.  Never falls back to DATABASE_URL.
// ---------------------------------------------------------------------------

const TEST_SLUG_PREFIX = "public-playable-it";

/**
 * Validate a raw database URL string against the integration-test safety rules.
 * Returns the (trimmed) URL on success; throws a descriptive Error on any
 * violation.  Returns null when `raw` is absent or blank.
 *
 * The raw URL is NEVER included in error messages because it may contain
 * credentials.
 *
 * Safety rules (all must pass):
 *  1. Protocol is postgresql: or postgres:
 *  2. Host is exactly localhost, 127.0.0.1, or the IPv6 loopback [::1].
 *     Note: WHATWG URL parsing returns "[::1]" (with brackets) in url.hostname
 *     on Node 20, so brackets are stripped before the membership check.
 *     Arbitrary *.local hosts are NOT accepted.
 *  3. The URL path must contain exactly one non-empty segment (the database
 *     name).  Additional segments and encoded slashes (%2F) are rejected.
 *  4. The raw path segment is decoded with decodeURIComponent().  Malformed
 *     percent sequences throw.  The decoded name is then lower-cased.
 *  5. The decoded database name is EITHER the exact string "tourney_test" OR
 *     starts with "test_" OR ends with "_test".
 *     startsWith/endsWith are used intentionally; /test/ substring matching
 *     would accept "contest".
 *  6. The decoded name must not contain the tokens prod, production, or staging
 *     when split on non-alphanumeric separators.  \b word-boundary regex is
 *     insufficient because underscore is a word character, so "prod_test" would
 *     escape the check.
 */
export function validateTestDatabaseUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL.");
  }

  const proto = url.protocol; // includes trailing colon
  if (proto !== "postgresql:" && proto !== "postgres:") {
    throw new Error(
      `TEST_DATABASE_URL must use the postgresql: or postgres: protocol, got "${proto}"`,
    );
  }

  // WHATWG URL returns "[::1]" (with surrounding brackets) for IPv6 on Node 20.
  // Strip brackets before the allowlist check so both "[::1]" and "::1" match.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `TEST_DATABASE_URL host must be localhost, 127.0.0.1, or [::1]. ` +
        "Refusing to run destructive tests against a non-loopback host.",
    );
  }

  // Require exactly one non-empty path segment after the leading slash.
  // url.pathname is the raw (percent-encoded) path — check it before decoding
  // so encoded slashes (%2F) are caught as part of the segment rather than
  // treated as separators.
  const rawPath = url.pathname; // e.g. "/tourney_test" or "/test_%70rod"
  const afterSlash = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
  if (afterSlash === "" || afterSlash.includes("/")) {
    throw new Error(
      "TEST_DATABASE_URL must have exactly one non-empty database path segment.",
    );
  }
  // Reject encoded path separators before decoding.
  if (/%2f/i.test(afterSlash)) {
    throw new Error(
      "TEST_DATABASE_URL database name must not contain an encoded path separator (%2F).",
    );
  }

  // Decode and lower-case.  decodeURIComponent throws on malformed sequences.
  let dbName: string;
  try {
    dbName = decodeURIComponent(afterSlash).toLowerCase();
  } catch {
    throw new Error(
      "TEST_DATABASE_URL database name contains malformed percent encoding.",
    );
  }

  const EXACT_ALLOWLIST = new Set(["tourney_test"]);
  const isAllowed =
    EXACT_ALLOWLIST.has(dbName) ||
    dbName.startsWith("test_") ||
    dbName.endsWith("_test");
  if (!isAllowed) {
    throw new Error(
      `TEST_DATABASE_URL database name is not allowed. ` +
        'It must be "tourney_test", or start with "test_", or end with "_test".',
    );
  }

  // Split on non-alphanumeric separators and reject any token that is a
  // known non-disposable environment name.  Using \b would miss underscored
  // names like "prod_test" because underscore is a word character.
  const FORBIDDEN_TOKENS = new Set(["prod", "production", "staging"]);
  const tokens = dbName.split(/[^a-z0-9]+/);
  const forbidden = tokens.find((tok) => FORBIDDEN_TOKENS.has(tok));
  if (forbidden) {
    throw new Error(
      `TEST_DATABASE_URL database name looks non-disposable (contains token "${forbidden}").`,
    );
  }

  return trimmed;
}

function getSafeTestDatabaseUrl(): string | null {
  return validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Unit tests for validateTestDatabaseUrl
// ---------------------------------------------------------------------------

describe("validateTestDatabaseUrl", () => {
  const v = validateTestDatabaseUrl;

  // ---- Accepted cases ----
  it("accepts localhost/tourney_test", () => {
    assert.equal(
      v("postgresql://u:p@localhost:5432/tourney_test"),
      "postgresql://u:p@localhost:5432/tourney_test",
    );
  });
  it("accepts 127.0.0.1/test_public_playable", () => {
    assert.equal(
      v("postgres://u:p@127.0.0.1:5432/test_public_playable"),
      "postgres://u:p@127.0.0.1:5432/test_public_playable",
    );
  });
  it("accepts [::1]/tourney_test", () => {
    assert.equal(
      v("postgresql://u:p@[::1]:5432/tourney_test"),
      "postgresql://u:p@[::1]:5432/tourney_test",
    );
  });
  it("returns null for undefined", () => {
    assert.equal(v(undefined), null);
  });
  it("returns null for blank string", () => {
    assert.equal(v("  "), null);
  });

  // ---- Rejected: protocol ----
  it("rejects non-PostgreSQL protocol", () => {
    assert.throws(
      () => v("mysql://u:p@localhost:3306/tourney_test"),
      /postgresql.*postgres/i,
    );
  });

  // ---- Rejected: host ----
  it("rejects a non-loopback remote host", () => {
    assert.throws(
      () => v("postgresql://u:p@db.example.com:5432/tourney_test"),
      /non-loopback/i,
    );
  });

  // ---- Rejected: db name — substring trap ----
  it("rejects 'contest' (contains 'test' as substring, not a suffix/prefix)", () => {
    assert.throws(
      () => v("postgresql://u:p@localhost:5432/contest"),
      /not allowed/i,
    );
  });

  // ---- Rejected: forbidden tokens with underscore separators ----
  it("rejects prod_test", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/prod_test"), /non-disposable/i);
  });
  it("rejects production_test", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/production_test"), /non-disposable/i);
  });
  it("rejects staging_test", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/staging_test"), /non-disposable/i);
  });
  it("rejects test_prod", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_prod"), /non-disposable/i);
  });
  it("rejects test_production", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_production"), /non-disposable/i);
  });
  it("rejects test_staging", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_staging"), /non-disposable/i);
  });

  // ---- Rejected: encoded forbidden names ----
  it("rejects test_%70rod (decodes to test_prod)", () => {
    // %70 = 'p', so test_%70rod decodes to test_prod
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_%70rod"), /non-disposable/i);
  });
  it("rejects test_%70roduction (decodes to test_production)", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_%70roduction"), /non-disposable/i);
  });
  it("rejects test_%73taging (decodes to test_staging)", () => {
    // %73 = 's'
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_%73taging"), /non-disposable/i);
  });

  // ---- Rejected: encoded path separator ----
  it("rejects test_%2Fprod (encoded slash in db name)", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_%2Fprod"), /encoded path separator/i);
  });

  // ---- Rejected: malformed percent encoding ----
  it("rejects malformed percent encoding", () => {
    assert.throws(() => v("postgresql://u:p@localhost:5432/test_%ZZname"), /malformed percent/i);
  });

  // ---- Rejected: additional path segments ----
  it("rejects URLs with additional path segments", () => {
    assert.throws(
      () => v("postgresql://u:p@localhost:5432/tourney_test/extra"),
      /exactly one.*path segment/i,
    );
  });

  // ---- No credentials in error messages ----
  it("does not include the password in error messages", () => {
    try {
      v("postgresql://user:supersecret@db.example.com:5432/tourney_test");
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(
        !e.message.includes("supersecret"),
        "error message must not contain the password",
      );
    }
  });
});

const integrationDbUrl = getSafeTestDatabaseUrl();
const runIntegration = Boolean(integrationDbUrl);
if (integrationDbUrl) {
  // Must be set before the first dynamic import of @/lib/db or anything that
  // transitively imports it, so Prisma binds to the test database only.
  process.env.DATABASE_URL = integrationDbUrl;
}

// ---------------------------------------------------------------------------
// Lazy dynamic imports — deferred until after DATABASE_URL is overridden.
// ---------------------------------------------------------------------------

type IntegrationModules = {
  prisma: (typeof import("@/lib/db"))["prisma"];
  mapGameToApiListItem: (typeof import("@/lib/api/v1/serialize-game"))["mapGameToApiListItem"];
  listGamesAdmin: (typeof import("@/lib/services/admin-games"))["listGamesAdmin"];
  listGamesForTournament: (typeof import("@/lib/services/games"))["listGamesForTournament"];
  listFinalGamesForTournament: (typeof import("@/lib/services/games"))["listFinalGamesForTournament"];
  listRecentGamesForHome: (typeof import("@/lib/services/games"))["listRecentGamesForHome"];
  listScheduleFilterFacets: (typeof import("@/lib/services/games"))["listScheduleFilterFacets"];
  listUpcomingGamesForHome: (typeof import("@/lib/services/games"))["listUpcomingGamesForHome"];
  listGamesForFavoriteTeamIds: (typeof import("@/lib/services/games"))["listGamesForFavoriteTeamIds"];
  listFinalGamesFilterFacets: (typeof import("@/lib/services/games"))["listFinalGamesFilterFacets"];
};

let integrationModulesPromise: Promise<IntegrationModules> | null = null;
function loadIntegrationModules(): Promise<IntegrationModules> {
  if (!integrationModulesPromise) {
    integrationModulesPromise = (async () => {
      const [{ prisma }, { mapGameToApiListItem }, { listGamesAdmin }, games] = await Promise.all([
        import("@/lib/db"),
        import("@/lib/api/v1/serialize-game"),
        import("@/lib/services/admin-games"),
        import("@/lib/services/games"),
      ]);
      return {
        prisma,
        mapGameToApiListItem,
        listGamesAdmin,
        listGamesForTournament: games.listGamesForTournament,
        listFinalGamesForTournament: games.listFinalGamesForTournament,
        listRecentGamesForHome: games.listRecentGamesForHome,
        listScheduleFilterFacets: games.listScheduleFilterFacets,
        listUpcomingGamesForHome: games.listUpcomingGamesForHome,
        listGamesForFavoriteTeamIds: games.listGamesForFavoriteTeamIds,
        listFinalGamesFilterFacets: games.listFinalGamesFilterFacets,
      };
    })();
  }
  return integrationModulesPromise;
}

// ---------------------------------------------------------------------------
// Fixture type
// ---------------------------------------------------------------------------

type FixtureIds = {
  /** Tournament slug — used as the cleanup key. */
  slug: string;
  tournamentId: string;
  divisionId: string;
  poolId: string;
  fieldId: string;
  /** Field used only by structural sit-out rows. */
  sitOutFieldId: string;
  teamAId: string;
  teamBId: string;
  /** Hamilton only appears through sit-out rows, never real games. */
  teamHamiltonId: string;
  /** A team that appears only through a FINAL structural sit-out. */
  teamFinalSitOutOnlyId: string;
  /** A FINAL real game — positive control for results/recent queries. */
  sourceFinalId: string;
  /** Day key (en-CA) for the schedule-only sit-out date. */
  sitOutOnlyDayKey: string;
  /** Day key (en-CA) for the results-only sit-out date. */
  finalSitOutOnlyDayKey: string;
  poolGameId: string;
  unassignedSitOutId: string;
  assignedSitOutId: string;
  oba12SitOutId: string;
  /** Structural R0 bye — FINAL status, placed near "now" for recent coverage. */
  structuralByeId: string;
  /** A separate FINAL structural sit-out using the sit-out field/date for results-facet coverage. */
  finalSitOutId: string;
  tbdFeederId: string;
  winnerFeederId: string;
  postponedId: string;
  cancelledRealId: string;
};

// ---------------------------------------------------------------------------
// Fixture seeding — slug is generated by the caller before the first DB write
// ---------------------------------------------------------------------------

async function seedPublicVisibilityFixture(slug: string): Promise<FixtureIds> {
  const { prisma } = await loadIntegrationModules();
  const now = new Date();

  const tourn = await prisma.tournament.create({
    data: {
      name: "Public playable filter",
      slug,
      shortLabel: "P",
      startDate: new Date(now.getTime() - 7 * 24 * 3600_000),
      endDate: new Date(now.getTime() + 7 * 24 * 3600_000),
      timezone: "America/Toronto",
      locationLabel: "Test",
      isPublished: true,
    },
  });

  const loc = await prisma.location.create({
    data: { tournamentId: tourn.id, name: "Main", isHeadquarters: true, sortOrder: 0 },
  });
  const field = await prisma.field.create({
    data: { tournamentId: tourn.id, locationId: loc.id, name: "Diamond 1", sortOrder: 0 },
  });
  const sitOutField = await prisma.field.create({
    data: { tournamentId: tourn.id, locationId: loc.id, name: "Sit-out only", sortOrder: 1 },
  });
  const div = await prisma.division.create({
    data: { tournamentId: tourn.id, name: "13U", sortOrder: 0 },
  });
  const pool = await prisma.pool.create({
    data: { divisionId: div.id, name: "A", sortOrder: 0 },
  });
  const [teamA, teamB, teamHamilton, teamFinalSitOutOnly] = await Promise.all([
    prisma.team.create({ data: { poolId: pool.id, name: "Markham", seed: 1 } }),
    prisma.team.create({ data: { poolId: pool.id, name: "Ajax", seed: 2 } }),
    prisma.team.create({ data: { poolId: pool.id, name: "Hamilton", seed: 3 } }),
    prisma.team.create({ data: { poolId: pool.id, name: "FinalSitOutTeam", seed: 4 } }),
  ]);

  const bracket = await prisma.bracket.create({
    data: {
      tournamentId: tourn.id,
      divisionId: div.id,
      name: "Championship",
      format: BracketFormat.DOUBLE_ELIMINATION,
      published: true,
    },
  });
  const round0 = await prisma.bracketRound.create({
    data: { bracketId: bracket.id, name: "Round 1", roundIndex: 0, roundType: BracketRoundType.WINNERS },
  });
  const round5 = await prisma.bracketRound.create({
    data: { bracketId: bracket.id, name: "Round 5", roundIndex: 5, roundType: BracketRoundType.WINNERS },
  });
  const round6 = await prisma.bracketRound.create({
    data: { bracketId: bracket.id, name: "Round 6", roundIndex: 6, roundType: BracketRoundType.WINNERS },
  });
  const round7 = await prisma.bracketRound.create({
    data: { bracketId: bracket.id, name: "Round 7", roundIndex: 7, roundType: BracketRoundType.WINNERS },
  });

  // ---------- Timestamps ----------
  const recentRealAt    = new Date(now.getTime() - 30 * 60_000);  // 30 min ago
  const recentSitOutAt  = new Date(now.getTime() - 20 * 60_000);  // 20 min ago (near now for recent coverage)
  const upcomingRealAt  = new Date(now.getTime() + 30 * 60_000);  // 30 min ahead
  const upcomingSitOutAt = new Date(now.getTime() + 40 * 60_000); // 40 min ahead

  // A day that contains only sit-out records (schedule facets)
  const sitOutOnlyDay = new Date(now.getTime() + 5 * 24 * 3600_000);
  sitOutOnlyDay.setHours(1, 0, 0, 0);

  // A separate day used only by the FINAL structural sit-out (results facets)
  const finalSitOutDay = new Date(now.getTime() - 3 * 24 * 3600_000);
  finalSitOutDay.setHours(1, 0, 0, 0);

  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const sitOutOnlyDayKey  = dayKeyFmt.format(sitOutOnlyDay);
  const finalSitOutOnlyDayKey = dayKeyFmt.format(finalSitOutDay);

  // ---------- Pool game (positive control: upcoming, scheduled) ----------
  const poolGame = await prisma.game.create({
    data: {
      tournamentId: tourn.id,
      poolId: pool.id,
      fieldId: field.id,
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      scheduledAt: upcomingRealAt,
      status: GameStatus.SCHEDULED,
      gameKind: GameKind.POOL,
      gameNumber: "P1",
    },
  });

  // ---------- Helper: create a bracket game + its BracketMatch ----------
  async function createBracketGame(opts: {
    roundId: string;
    bracketId: string;
    gameNumber: string;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    homeIsBye?: boolean;
    awayIsBye?: boolean;
    fieldId?: string;
    scheduledAt?: Date;
    status?: GameStatus;
    homeRuns?: number | null;
    awayRuns?: number | null;
    matchIndex: number;
    bracketPosition: number;
    homeFromMatchId?: string;
    homeFromKind?: BracketSlotFeedKind;
  }) {
    const game = await prisma.game.create({
      data: {
        tournamentId: tourn.id,
        fieldId: opts.fieldId ?? field.id,
        homeTeamId: opts.homeTeamId ?? null,
        awayTeamId: opts.awayTeamId ?? null,
        scheduledAt: opts.scheduledAt ?? upcomingRealAt,
        status: opts.status ?? GameStatus.SCHEDULED,
        gameKind: GameKind.PLAYOFF,
        gameNumber: opts.gameNumber,
        bracketId: opts.bracketId,
        bracketRoundId: opts.roundId,
        bracketPosition: opts.bracketPosition,
        homeRuns: opts.homeRuns ?? null,
        awayRuns: opts.awayRuns ?? null,
      },
    });
    const match = await prisma.bracketMatch.create({
      data: {
        bracketRoundId: opts.roundId,
        matchIndex: opts.matchIndex,
        gameId: game.id,
        homeIsBye: opts.homeIsBye ?? false,
        awayIsBye: opts.awayIsBye ?? false,
        homeFromMatchId: opts.homeFromMatchId,
        homeFromKind: opts.homeFromKind,
      },
    });
    return { game, match };
  }

  // ---------- Real bracket final (positive control for results/recent) ----------
  const { game: sourceGame, match: sourceMatch } = await createBracketGame({
    roundId: round0.id,
    bracketId: bracket.id,
    gameNumber: "2",
    homeTeamId: teamA.id,
    awayTeamId: teamB.id,
    matchIndex: 0,
    bracketPosition: 0,
    status: GameStatus.FINAL,
    homeRuns: 5,
    awayRuns: 2,
    scheduledAt: recentRealAt,
  });

  // ---------- Upcoming sit-outs (schedule filter coverage) ----------
  const { game: unassignedSitOut } = await createBracketGame({
    roundId: round5.id,
    bracketId: bracket.id,
    gameNumber: "R5 Bye",
    awayIsBye: true,
    fieldId: sitOutField.id,
    scheduledAt: upcomingSitOutAt,
    matchIndex: 0,
    bracketPosition: 0,
  });

  const { game: assignedSitOut } = await createBracketGame({
    roundId: round5.id,
    bracketId: bracket.id,
    gameNumber: "R5 Bye",
    homeTeamId: teamHamilton.id,
    awayIsBye: true,
    fieldId: sitOutField.id,
    scheduledAt: upcomingSitOutAt,
    matchIndex: 1,
    bracketPosition: 1,
  });

  // OBA 12 sit-out — sits on the sit-out-only schedule day
  const { game: oba12SitOut } = await createBracketGame({
    roundId: round6.id,
    bracketId: bracket.id,
    gameNumber: "R6 Bye",
    awayIsBye: true,
    fieldId: sitOutField.id,
    scheduledAt: sitOutOnlyDay,
    matchIndex: 0,
    bracketPosition: 0,
  });

  // ---------- Structural R0 bye — FINAL, near "now" for recent coverage ----------
  const { game: structuralBye } = await createBracketGame({
    roundId: round0.id,
    bracketId: bracket.id,
    gameNumber: "BYE-R0",
    homeIsBye: true,
    awayTeamId: teamHamilton.id,
    status: GameStatus.FINAL,
    homeRuns: null,
    awayRuns: null,
    scheduledAt: recentSitOutAt,
    matchIndex: 1,
    bracketPosition: 1,
  });

  // ---------- FINAL structural sit-out on sit-out-only field/day
  //            — for results-facet coverage (day, field, team all exclusive) ----------
  const { game: finalSitOut } = await createBracketGame({
    roundId: round7.id,
    bracketId: bracket.id,
    gameNumber: "BYE-R7-FINAL",
    awayIsBye: true,
    homeTeamId: teamFinalSitOutOnly.id,
    fieldId: sitOutField.id,
    status: GameStatus.FINAL,
    homeRuns: null,
    awayRuns: null,
    scheduledAt: finalSitOutDay,
    matchIndex: 0,
    bracketPosition: 0,
  });

  // ---------- Legitimate feeder / TBD games ----------
  const { game: tbdFeeder } = await createBracketGame({
    roundId: round5.id,
    bracketId: bracket.id,
    gameNumber: "21",
    scheduledAt: upcomingRealAt,
    matchIndex: 2,
    bracketPosition: 2,
  });

  const { game: winnerFeeder } = await createBracketGame({
    roundId: round5.id,
    bracketId: bracket.id,
    gameNumber: "10",
    awayTeamId: teamA.id,
    homeFromMatchId: sourceMatch.id,
    homeFromKind: BracketSlotFeedKind.WINNER,
    scheduledAt: upcomingRealAt,
    matchIndex: 3,
    bracketPosition: 3,
  });

  // ---------- Postponed / cancelled real games ----------
  const postponed = await prisma.game.create({
    data: {
      tournamentId: tourn.id,
      poolId: pool.id,
      fieldId: field.id,
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      scheduledAt: upcomingRealAt,
      status: GameStatus.POSTPONED,
      gameKind: GameKind.POOL,
      gameNumber: "P-POST",
    },
  });

  const cancelledReal = await prisma.game.create({
    data: {
      tournamentId: tourn.id,
      poolId: pool.id,
      fieldId: field.id,
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      scheduledAt: recentRealAt,
      status: GameStatus.CANCELLED,
      gameKind: GameKind.POOL,
      gameNumber: "P-CAN",
    },
  });

  return {
    slug,
    tournamentId: tourn.id,
    divisionId: div.id,
    poolId: pool.id,
    fieldId: field.id,
    sitOutFieldId: sitOutField.id,
    teamAId: teamA.id,
    teamBId: teamB.id,
    teamHamiltonId: teamHamilton.id,
    teamFinalSitOutOnlyId: teamFinalSitOutOnly.id,
    sourceFinalId: sourceGame.id,
    sitOutOnlyDayKey,
    finalSitOutOnlyDayKey,
    poolGameId: poolGame.id,
    unassignedSitOutId: unassignedSitOut.id,
    assignedSitOutId: assignedSitOut.id,
    oba12SitOutId: oba12SitOut.id,
    structuralByeId: structuralBye.id,
    finalSitOutId: finalSitOut.id,
    tbdFeederId: tbdFeeder.id,
    winnerFeederId: winnerFeeder.id,
    postponedId: postponed.id,
    cancelledRealId: cancelledReal.id,
  };
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("public schedule visibility (integration)", () => {
  /**
   * Track slugs registered *before* seeding so afterEach can clean up even
   * when seedPublicVisibilityFixture() throws mid-way through.
   */
  const fixtureSlugs = new Set<string>();

  async function cleanupFixtureBySlug(slug: string) {
    const { prisma } = await loadIntegrationModules();
    const tournament = await prisma.tournament.findFirst({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!tournament) return;
    if (!tournament.slug.startsWith(TEST_SLUG_PREFIX)) {
      throw new Error(`Refusing cleanup for non-test slug: ${tournament.slug}`);
    }
    await prisma.tournament.delete({ where: { id: tournament.id } });
  }

  afterEach(async () => {
    for (const slug of fixtureSlugs) {
      await cleanupFixtureBySlug(slug);
      fixtureSlugs.delete(slug);
    }
  });

  /** Generate a unique slug, register it for cleanup, then seed. */
  function makeSlug() {
    return `${TEST_SLUG_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  it("excludes structural bye and sit-out records from public listings", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listGamesForTournament } = await loadIntegrationModules();
    const schedule = await listGamesForTournament(fx.tournamentId);
    const ids = new Set(schedule.map((g) => g.id));

    assert.ok(ids.has(fx.poolGameId), "pool game remains visible");
    assert.ok(ids.has(fx.tbdFeederId), "TBD-vs-TBD feeder remains visible");
    assert.ok(ids.has(fx.winnerFeederId), "winner feeder remains visible");
    assert.ok(ids.has(fx.postponedId), "postponed real game remains visible");
    assert.equal(ids.has(fx.unassignedSitOutId), false, "unassigned OBA 13 sit-out hidden");
    assert.equal(ids.has(fx.assignedSitOutId), false, "assigned OBA 13 sit-out hidden");
    assert.equal(ids.has(fx.oba12SitOutId), false, "OBA 12 sit-out hidden");
    assert.equal(ids.has(fx.structuralByeId), false, "structural first-round bye hidden");
  });

  it("includes cancelled real games in public results and excludes FINAL structural sit-outs", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listFinalGamesForTournament } = await loadIntegrationModules();
    const results = await listFinalGamesForTournament(fx.tournamentId);
    const ids = new Set(results.map((g) => g.id));

    assert.ok(ids.has(fx.cancelledRealId), "cancelled real matchup remains in results");
    assert.ok(ids.has(fx.sourceFinalId), "normal final remains in results");
    // structuralBye is FINAL — exclusion relies on the new bye filter, not status
    assert.equal(ids.has(fx.structuralByeId), false, "FINAL structural R0 bye excluded by bye filter");
    // finalSitOut is also FINAL — exclusion relies on the bye filter
    assert.equal(ids.has(fx.finalSitOutId), false, "FINAL structural R7 bye excluded by bye filter");
  });

  it("excludes sit-out-only dates, fields and teams from schedule facets", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listScheduleFilterFacets } = await loadIntegrationModules();
    const facets = await listScheduleFilterFacets(fx.tournamentId, undefined, "America/Toronto");

    // Positive controls
    assert.ok(facets.fieldIds.has(fx.fieldId), "real field remains in schedule facets");
    assert.ok(facets.teamIds.has(fx.teamAId), "team in real games remains in schedule facets");
    assert.ok(facets.teamIds.has(fx.teamBId), "team in real games remains in schedule facets");

    // Exclusions
    assert.equal(facets.fieldIds.has(fx.sitOutFieldId), false, "sit-out-only field excluded from schedule facets");
    assert.equal(
      facets.teamIds.has(fx.teamHamiltonId),
      false,
      "team only in upcoming sit-out rows excluded from schedule facets",
    );
    assert.equal(
      facets.dayOptions.some((d) => d.value === fx.sitOutOnlyDayKey),
      false,
      "sit-out-only day excluded from schedule facets",
    );
  });

  it("excludes sit-outs from home upcoming and recent queries", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listUpcomingGamesForHome, listRecentGamesForHome } = await loadIntegrationModules();
    const upcoming = await listUpcomingGamesForHome(fx.tournamentId, undefined);
    const recent = await listRecentGamesForHome(fx.tournamentId, undefined);
    const upcomingIds = new Set(upcoming.map((g) => g.id));
    const recentIds = new Set(recent.map((g) => g.id));

    // Positive controls
    assert.ok(upcomingIds.has(fx.poolGameId), "upcoming includes a real playable game");
    assert.ok(recentIds.has(fx.sourceFinalId), "recent includes a real final game");

    // Exclusions (upcoming)
    assert.equal(upcomingIds.has(fx.unassignedSitOutId), false, "upcoming excludes unassigned sit-out");
    assert.equal(upcomingIds.has(fx.assignedSitOutId), false, "upcoming excludes assigned sit-out");

    // Exclusions (recent) — structuralBye is FINAL and within the recent window
    assert.equal(recentIds.has(fx.structuralByeId), false, "recent excludes FINAL structural bye");
  });

  it("keeps sit-out records available in admin game management", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listGamesAdmin } = await loadIntegrationModules();
    const adminGames = await listGamesAdmin(fx.tournamentId);
    const ids = new Set(adminGames.map((g) => g.id));

    assert.ok(ids.has(fx.unassignedSitOutId), "admin sees unassigned sit-out");
    assert.ok(ids.has(fx.assignedSitOutId), "admin sees assigned sit-out");
    assert.ok(ids.has(fx.oba12SitOutId), "admin sees OBA 12 sit-out");
    assert.ok(ids.has(fx.structuralByeId), "admin sees structural R0 bye");
    assert.ok(ids.has(fx.finalSitOutId), "admin sees FINAL structural sit-out");
  });

  it("serializes only public-playable games for schedule API mapping", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listGamesForTournament, mapGameToApiListItem } = await loadIntegrationModules();
    const all = await listGamesForTournament(fx.tournamentId);
    const apiItems = all.map(mapGameToApiListItem);
    const numbers = apiItems.map((g) => g.gameNumber);

    assert.ok(numbers.includes("P1"), "pool game serialized");
    assert.ok(numbers.includes("21"), "TBD feeder serialized");
    assert.ok(numbers.includes("10"), "winner feeder serialized");
    assert.equal(numbers.includes("R5 Bye"), false, "R5 Bye not serialized");
    assert.equal(numbers.includes("R6 Bye"), false, "R6 Bye not serialized");
    assert.equal(numbers.includes("BYE-R0"), false, "BYE-R0 not serialized");
    assert.equal(numbers.includes("BYE-R7-FINAL"), false, "BYE-R7-FINAL not serialized");
  });

  it("filters favorites query with structural visibility while keeping real favorite games", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listGamesForFavoriteTeamIds } = await loadIntegrationModules();
    const rows = await listGamesForFavoriteTeamIds(
      fx.tournamentId,
      undefined,
      [fx.teamAId, fx.teamHamiltonId, fx.teamFinalSitOutOnlyId],
    );
    const ids = new Set(rows.map((g) => g.id));

    assert.ok(ids.has(fx.poolGameId), "favorite query keeps normal pool game");
    assert.equal(ids.has(fx.assignedSitOutId), false, "favorite query excludes assigned upcoming sit-out");
    assert.equal(ids.has(fx.finalSitOutId), false, "favorite query excludes FINAL structural sit-out");
  });

  it("filters final-result facets to exclude sit-out-only day/field/team values", async (t) => {
    if (!runIntegration) {
      t.skip("TEST_DATABASE_URL not set (or did not pass safety checks)");
      return;
    }

    const slug = makeSlug();
    fixtureSlugs.add(slug);
    const fx = await seedPublicVisibilityFixture(slug);
    const { listFinalGamesFilterFacets } = await loadIntegrationModules();
    const facets = await listFinalGamesFilterFacets(fx.tournamentId, undefined, "America/Toronto");

    // Positive controls
    assert.ok(facets.teamIds.has(fx.teamAId), "results facets include team from real final");
    assert.ok(facets.fieldIds.has(fx.fieldId), "results facets include field of real final");
    // recentRealAt day must appear since sourceFinalId is a real FINAL on that day
    assert.ok(facets.dayOptions.length > 0, "results facets include at least one day");

    // Exclusions driven by the bye filter (not status — finalSitOut IS FINAL)
    assert.equal(
      facets.teamIds.has(fx.teamFinalSitOutOnlyId),
      false,
      "results facets exclude team only in FINAL structural sit-out",
    );
    assert.equal(
      facets.fieldIds.has(fx.sitOutFieldId),
      false,
      "results facets exclude field only used by FINAL structural sit-out",
    );
    assert.equal(
      facets.dayOptions.some((d) => d.value === fx.finalSitOutOnlyDayKey),
      false,
      "results facets exclude day only present in FINAL structural sit-out",
    );
  });
});
