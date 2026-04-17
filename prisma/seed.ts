import { GameResultType, GameStatus, PrismaClient } from "@prisma/client";
import { createDivisionPlayoffBracket } from "../src/lib/services/bracket-division-build";
import { recomputeAllPoolsForTournament } from "../src/lib/services/standings";

const prisma = new PrismaClient();

function dayAt(hour: number, minute: number, dayOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  await prisma.weatherCache.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.tournamentSubscriber.deleteMany();
  await prisma.faqItem.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.poolStanding.deleteMany();
  await prisma.game.deleteMany();
  await prisma.bracketRound.deleteMany();
  await prisma.bracket.deleteMany();
  await prisma.team.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.division.deleteMany();
  await prisma.field.deleteMany();
  await prisma.location.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  const t10 = await prisma.tournament.create({
    data: {
      name: "Spring Classic",
      slug: "spring-10u",
      shortLabel: "10U",
      startDate: new Date(new Date().getFullYear(), 5, 1),
      endDate: new Date(new Date().getFullYear(), 5, 3),
      timezone: "America/Chicago",
      locationLabel: "Round Rock, TX",
      latitude: 30.5086,
      longitude: -97.6789,
      isPublished: true,
    },
  });

  const t11 = await prisma.tournament.create({
    data: {
      name: "Spring Classic",
      slug: "spring-11u",
      shortLabel: "11U",
      startDate: new Date(new Date().getFullYear(), 5, 1),
      endDate: new Date(new Date().getFullYear(), 5, 3),
      timezone: "America/Chicago",
      locationLabel: "Round Rock, TX",
      latitude: 30.5086,
      longitude: -97.6789,
      isPublished: true,
    },
  });

  await prisma.tournamentSubscriber.createMany({
    data: [
      {
        tournamentId: t10.id,
        email: "coach.demo@example.com",
        name: "Coach Pat",
        roleLabel: "Head coach",
      },
      {
        tournamentId: t10.id,
        email: "manager.demo@example.com",
        name: "Taylor Manager",
        roleLabel: "Team manager",
      },
      {
        tournamentId: t10.id,
        email: "parent.demo@example.com",
        name: "Chris Parent",
        roleLabel: "Parent",
      },
    ],
  });

  for (const t of [t10, t11]) {
    const main = await prisma.location.create({
      data: {
        tournamentId: t.id,
        name: "Main Complex",
        address: "3400 E Palm Valley Blvd, Round Rock, TX 78665",
        latitude: 30.5086,
        longitude: -97.6789,
        isHeadquarters: true,
        sortOrder: 0,
      },
    });
    await prisma.location.create({
      data: {
        tournamentId: t.id,
        name: "Overflow Parking",
        address: "2800 County Rd 175, Round Rock, TX 78664",
        isHeadquarters: false,
        sortOrder: 1,
      },
    });
    await prisma.field.createMany({
      data: [
        { tournamentId: t.id, locationId: main.id, name: "Field 1", sortOrder: 0 },
        { tournamentId: t.id, locationId: main.id, name: "Field 2", sortOrder: 1 },
        { tournamentId: t.id, locationId: main.id, name: "Field 3 (Showcase)", sortOrder: 2 },
      ],
    });
  }

  const fields10 = await prisma.field.findMany({
    where: { tournamentId: t10.id },
    orderBy: { sortOrder: "asc" },
  });
  const fields11 = await prisma.field.findMany({
    where: { tournamentId: t11.id },
    orderBy: { sortOrder: "asc" },
  });

  const div10 = await prisma.division.create({
    data: { tournamentId: t10.id, name: "Division A", sortOrder: 0 },
  });
  const pool10a = await prisma.pool.create({
    data: { divisionId: div10.id, name: "Pool A", sortOrder: 0, teamsAdvancing: 2 },
  });
  const pool10b = await prisma.pool.create({
    data: { divisionId: div10.id, name: "Pool B", sortOrder: 1, teamsAdvancing: 2 },
  });

  const teams10a = await prisma.$transaction([
    prisma.team.create({
      data: { poolId: pool10a.id, name: "Lightning", seed: 1 },
    }),
    prisma.team.create({
      data: { poolId: pool10a.id, name: "Storm", seed: 2 },
    }),
    prisma.team.create({
      data: { poolId: pool10a.id, name: "Riptide", seed: 3 },
    }),
    prisma.team.create({
      data: { poolId: pool10a.id, name: "Vipers", seed: 4 },
    }),
  ]);

  const teams10b = await prisma.$transaction([
    prisma.team.create({
      data: { poolId: pool10b.id, name: "Thunder", seed: 1 },
    }),
    prisma.team.create({
      data: { poolId: pool10b.id, name: "Mustangs", seed: 2 },
    }),
  ]);

  const [tA, tB, tC, tD] = teams10a;
  const [tE, tF] = teams10b;

  await prisma.game.createMany({
    data: [
      {
        tournamentId: t10.id,
        poolId: pool10a.id,
        fieldId: fields10[0]!.id,
        homeTeamId: tA.id,
        awayTeamId: tB.id,
        scheduledAt: dayAt(9, 0, 0),
        status: GameStatus.FINAL,
        resultType: GameResultType.REGULAR,
        homeRuns: 5,
        awayRuns: 2,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 6,
        homeOffensiveInnings: 6,
        awayOffensiveInnings: 6,
      },
      {
        tournamentId: t10.id,
        poolId: pool10a.id,
        fieldId: fields10[1]!.id,
        homeTeamId: tC.id,
        awayTeamId: tD.id,
        scheduledAt: dayAt(9, 0, 0),
        status: GameStatus.FINAL,
        resultType: GameResultType.REGULAR,
        homeRuns: 4,
        awayRuns: 4,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 6,
        homeOffensiveInnings: 6,
        awayOffensiveInnings: 6,
      },
      {
        tournamentId: t10.id,
        poolId: pool10a.id,
        fieldId: fields10[0]!.id,
        homeTeamId: tA.id,
        awayTeamId: tC.id,
        scheduledAt: dayAt(11, 0, 0),
        status: GameStatus.FINAL,
        resultType: GameResultType.REGULAR,
        homeRuns: 3,
        awayRuns: 1,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 6,
        homeOffensiveInnings: 6,
        awayOffensiveInnings: 6,
      },
      {
        tournamentId: t10.id,
        poolId: pool10a.id,
        fieldId: fields10[2]!.id,
        homeTeamId: tB.id,
        awayTeamId: tD.id,
        scheduledAt: dayAt(11, 30, 0),
        status: GameStatus.LIVE,
        resultType: GameResultType.REGULAR,
        homeRuns: 2,
        awayRuns: 2,
        homeDefensiveInnings: 4,
        awayDefensiveInnings: 4,
        homeOffensiveInnings: 4,
        awayOffensiveInnings: 4,
      },
      {
        tournamentId: t10.id,
        poolId: pool10a.id,
        fieldId: fields10[1]!.id,
        homeTeamId: tA.id,
        awayTeamId: tD.id,
        scheduledAt: dayAt(15, 0, 1),
        status: GameStatus.SCHEDULED,
        resultType: GameResultType.REGULAR,
      },
      {
        tournamentId: t10.id,
        poolId: pool10b.id,
        fieldId: fields10[0]!.id,
        homeTeamId: tE.id,
        awayTeamId: tF.id,
        scheduledAt: dayAt(13, 0, 0),
        status: GameStatus.FINAL,
        resultType: GameResultType.FORFEIT_HOME_WINS,
        homeRuns: 7,
        awayRuns: 0,
        homeDefensiveInnings: 0,
        awayDefensiveInnings: 0,
        homeOffensiveInnings: 0,
        awayOffensiveInnings: 0,
      },
    ],
  });

  const div11 = await prisma.division.create({
    data: { tournamentId: t11.id, name: "Division A", sortOrder: 0 },
  });
  const pool11 = await prisma.pool.create({
    data: { divisionId: div11.id, name: "Pool A", sortOrder: 0 },
  });
  const u11a = await prisma.team.create({
    data: { poolId: pool11.id, name: "Coyotes" },
  });
  const u11b = await prisma.team.create({
    data: { poolId: pool11.id, name: "Eagles" },
  });
  await prisma.game.create({
    data: {
      tournamentId: t11.id,
      poolId: pool11.id,
      fieldId: fields11[0]!.id,
      homeTeamId: u11a.id,
      awayTeamId: u11b.id,
      scheduledAt: dayAt(10, 0, 0),
      status: GameStatus.SCHEDULED,
    },
  });

  for (const t of [t10, t11]) {
    await prisma.announcement.createMany({
      data: [
        {
          tournamentId: t.id,
          title: "Welcome to Tournament Hub",
          body: "Good luck to all teams. Please arrive 45 minutes before first pitch.",
          priority: false,
        },
        {
          tournamentId: t.id,
          title: "Gate opens at 7:00 AM",
          body: "Park in Lot B if Field 3 is your first game.",
          priority: true,
        },
      ],
    });
    await prisma.faqItem.createMany({
      data: [
        {
          tournamentId: t.id,
          question: "Where is the concession stand?",
          answer: "Behind Field 1 near the pavilion.",
          sortOrder: 0,
        },
        {
          tournamentId: t.id,
          question: "Metal cleats allowed?",
          answer: "Molded plastic only for all youth divisions at this complex.",
          sortOrder: 1,
        },
      ],
    });
  }

  await recomputeAllPoolsForTournament(t10.id);
  await recomputeAllPoolsForTournament(t11.id);

  await createDivisionPlayoffBracket({
    tournamentId: t10.id,
    divisionId: div10.id,
    name: "Championship",
    fieldId: fields10[2]!.id,
    startsAt: dayAt(18, 0, 2),
    hoursBetweenRounds: 2,
    published: true,
    firstRound: [
      { home: { poolId: pool10a.id, rank: 1 }, away: { poolId: pool10b.id, rank: 1 } },
      { home: { poolId: pool10a.id, rank: 2 }, away: { poolId: pool10b.id, rank: 2 } },
    ],
  });

  /* demo admin user — sign-in when OAuth is configured; password auth not seeded */
  await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Demo Admin",
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  console.log("Seed complete. Tournaments: spring-10u, spring-11u");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
