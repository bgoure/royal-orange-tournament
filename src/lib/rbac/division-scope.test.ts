import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertDivisionScope,
  assertPoolDivisionScope,
  assertTeamDivisionScope,
} from "@/lib/rbac/division-scope";

const run = Boolean(process.env.DATABASE_URL);

describe("division-scope asserts", () => {
  it("allows ADMIN everywhere and denies POWER_USER outside assigned divisions", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const slug = `rbac-scope-${Date.now()}`;
    const tourn = await prisma.tournament.create({
      data: {
        name: "RBAC scope test",
        slug,
        shortLabel: "R",
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 5, 3),
        timezone: "America/Chicago",
        locationLabel: "Test",
        isPublished: false,
      },
    });

    try {
      const [divA, divB] = await Promise.all([
        prisma.division.create({ data: { tournamentId: tourn.id, name: "A", sortOrder: 0 } }),
        prisma.division.create({ data: { tournamentId: tourn.id, name: "B", sortOrder: 1 } }),
      ]);
      const [poolA, poolB] = await Promise.all([
        prisma.pool.create({ data: { divisionId: divA.id, name: "PA", sortOrder: 0 } }),
        prisma.pool.create({ data: { divisionId: divB.id, name: "PB", sortOrder: 0 } }),
      ]);
      const [teamA, teamB] = await Promise.all([
        prisma.team.create({ data: { poolId: poolA.id, name: "TA", seed: 1 } }),
        prisma.team.create({ data: { poolId: poolB.id, name: "TB", seed: 1 } }),
      ]);

      const power = await prisma.user.create({
        data: {
          email: `power-${Date.now()}@example.com`,
          name: "Power",
          role: Role.POWER_USER,
        },
      });
      await prisma.userDivisionAssignment.create({
        data: { userId: power.id, divisionId: divA.id },
      });

      assert.equal(await assertDivisionScope("admin", Role.ADMIN, divB.id), null);
      assert.equal(await assertDivisionScope(power.id, Role.POWER_USER, divA.id), null);
      assert.match(
        (await assertDivisionScope(power.id, Role.POWER_USER, divB.id)) ?? "",
        /access/i,
      );

      assert.equal(await assertPoolDivisionScope(power.id, Role.POWER_USER, poolA.id), null);
      assert.match(
        (await assertPoolDivisionScope(power.id, Role.POWER_USER, poolB.id)) ?? "",
        /access/i,
      );

      assert.equal(await assertTeamDivisionScope(power.id, Role.POWER_USER, teamA.id), null);
      assert.match(
        (await assertTeamDivisionScope(power.id, Role.POWER_USER, teamB.id)) ?? "",
        /access/i,
      );

      await prisma.user.delete({ where: { id: power.id } });
    } finally {
      await prisma.tournament.delete({ where: { id: tourn.id } });
    }
  });
});
