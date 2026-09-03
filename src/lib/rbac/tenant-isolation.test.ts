/**
 * Tenant isolation integration tests.
 *
 * Requires TEST_DATABASE_URL pointing at a disposable Postgres database.
 * Refuses to run against DATABASE_URL unless TOURNEY_ALLOW_TEST_ON_DATABASE_URL=1
 * and the URL host looks like a local/test database.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { OrganizationMemberRole, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertUserCanAccessTournament, getAuthorizedTournamentForAdmin } from "@/lib/rbac/tenant-access";
import { assertDivisionScope } from "@/lib/rbac/division-scope";
import { listTournamentsForAdminHub } from "@/lib/tournament-context";

function resolveTestDatabaseUrl(): string | null {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testUrl) return testUrl;

  if (process.env.TOURNEY_ALLOW_TEST_ON_DATABASE_URL === "1") {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) return null;
    // Soft guard: refuse obvious production Neon hosts unless explicitly overridden.
    if (/neon\.tech/i.test(url) && process.env.TOURNEY_ALLOW_DESTRUCTIVE_NEON_TESTS !== "1") {
      console.warn(
        "[tenant-isolation] Refusing DATABASE_URL on neon.tech without TOURNEY_ALLOW_DESTRUCTIVE_NEON_TESTS=1",
      );
      return null;
    }
    return url;
  }
  return null;
}

const testDbUrl = resolveTestDatabaseUrl();
const run = Boolean(testDbUrl);

type Fixture = {
  orgAId: string;
  orgBId: string;
  tournAId: string;
  tournBId: string;
  tournASlug: string;
  tournBSlug: string;
  divA1Id: string;
  divA2Id: string;
  platformAdminId: string;
  orgOwnerId: string;
  powerUserId: string;
  scorekeeperId: string;
};

describe("tenant isolation", () => {
  let fx: Fixture | null = null;

  before(async () => {
    if (!run) return;
    const stamp = Date.now();
    const orgA = await prisma.organization.create({
      data: { name: `Org A ${stamp}`, slug: `org-a-${stamp}`, brandName: "Org A" },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org B ${stamp}`, slug: `org-b-${stamp}`, brandName: "Org B" },
    });

    const tournA = await prisma.tournament.create({
      data: {
        name: "Tourn A",
        slug: `tourn-a-${stamp}`,
        shortLabel: "A",
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 5, 3),
        timezone: "America/Toronto",
        locationLabel: "Park A",
        isPublished: true,
        organizationId: orgA.id,
      },
    });
    const tournB = await prisma.tournament.create({
      data: {
        name: "Tourn B",
        slug: `tourn-b-${stamp}`,
        shortLabel: "B",
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 5, 3),
        timezone: "America/Toronto",
        locationLabel: "Park B",
        isPublished: true,
        organizationId: orgB.id,
      },
    });

    const [divA1, divA2] = await Promise.all([
      prisma.division.create({ data: { tournamentId: tournA.id, name: "10U", sortOrder: 0 } }),
      prisma.division.create({ data: { tournamentId: tournA.id, name: "12U", sortOrder: 1 } }),
    ]);

    const platformAdmin = await prisma.user.create({
      data: { email: `padmin-${stamp}@example.com`, role: Role.ADMIN, name: "Platform Admin" },
    });
    const orgOwner = await prisma.user.create({
      data: { email: `owner-${stamp}@example.com`, role: Role.POWER_USER, name: "Org Owner" },
    });
    const powerUser = await prisma.user.create({
      data: { email: `power-${stamp}@example.com`, role: Role.POWER_USER, name: "Power" },
    });
    const scorekeeper = await prisma.user.create({
      data: { email: `sk-${stamp}@example.com`, role: Role.SCOREKEEPER, name: "Scorekeeper" },
    });

    await prisma.organizationMember.createMany({
      data: [
        { organizationId: orgA.id, userId: orgOwner.id, role: OrganizationMemberRole.OWNER },
        { organizationId: orgA.id, userId: powerUser.id, role: OrganizationMemberRole.MEMBER },
        { organizationId: orgA.id, userId: scorekeeper.id, role: OrganizationMemberRole.MEMBER },
      ],
    });

    await prisma.userDivisionAssignment.createMany({
      data: [
        { userId: powerUser.id, divisionId: divA1.id },
        { userId: scorekeeper.id, divisionId: divA1.id },
      ],
    });

    fx = {
      orgAId: orgA.id,
      orgBId: orgB.id,
      tournAId: tournA.id,
      tournBId: tournB.id,
      tournASlug: tournA.slug,
      tournBSlug: tournB.slug,
      divA1Id: divA1.id,
      divA2Id: divA2.id,
      platformAdminId: platformAdmin.id,
      orgOwnerId: orgOwner.id,
      powerUserId: powerUser.id,
      scorekeeperId: scorekeeper.id,
    };
  });

  after(async () => {
    if (!fx) return;
    await prisma.tournament.deleteMany({ where: { id: { in: [fx.tournAId, fx.tournBId] } } });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [fx.platformAdminId, fx.orgOwnerId, fx.powerUserId, fx.scorekeeperId],
        },
      },
    });
    await prisma.organization.deleteMany({ where: { id: { in: [fx.orgAId, fx.orgBId] } } });
  });

  it("admin page helper returns null without an actor", async () => {
    assert.equal(await getAuthorizedTournamentForAdmin(null), null);
  });

  it("platform ADMIN can access either organization tournament", async (t) => {
    if (!run || !fx) {
      t.skip("TEST_DATABASE_URL (or allowed disposable DATABASE_URL) not set");
      return;
    }
    const a = await assertUserCanAccessTournament(
      { userId: fx.platformAdminId, role: Role.ADMIN },
      { id: fx.tournAId },
    );
    const b = await assertUserCanAccessTournament(
      { userId: fx.platformAdminId, role: Role.ADMIN },
      { id: fx.tournBId },
    );
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok) assert.equal(a.viaPlatformAdminBypass, true);
  });

  it("org member cannot select or access the other org tournament", async (t) => {
    if (!run || !fx) {
      t.skip("TEST_DATABASE_URL (or allowed disposable DATABASE_URL) not set");
      return;
    }
    const denied = await assertUserCanAccessTournament(
      { userId: fx.orgOwnerId, role: Role.POWER_USER },
      { slug: fx.tournBSlug },
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 403);

    const allowed = await assertUserCanAccessTournament(
      { userId: fx.orgOwnerId, role: Role.POWER_USER },
      { slug: fx.tournASlug },
    );
    assert.equal(allowed.ok, true);
  });

  it("hub listing hides other-org tournaments for non-admins", async (t) => {
    if (!run || !fx) {
      t.skip("TEST_DATABASE_URL (or allowed disposable DATABASE_URL) not set");
      return;
    }
    const rows = await listTournamentsForAdminHub({
      userId: fx.powerUserId,
      role: Role.POWER_USER,
    });
    const ids = new Set(rows.map((r) => r.id));
    assert.equal(ids.has(fx.tournAId), true);
    assert.equal(ids.has(fx.tournBId), false);
  });

  it("org member cannot access other-org tournament for admin page context", async (t) => {
    if (!run || !fx) {
      t.skip("TEST_DATABASE_URL (or allowed disposable DATABASE_URL) not set");
      return;
    }
    const denied = await assertUserCanAccessTournament(
      { userId: fx.powerUserId, role: Role.POWER_USER },
      { id: fx.tournBId },
    );
    assert.equal(denied.ok, false);
  });

  it("POWER_USER division scope allows assigned and denies unassigned", async (t) => {
    if (!run || !fx) {
      t.skip("TEST_DATABASE_URL (or allowed disposable DATABASE_URL) not set");
      return;
    }
    assert.equal(await assertDivisionScope(fx.powerUserId, Role.POWER_USER, fx.divA1Id), null);
    assert.match(
      (await assertDivisionScope(fx.powerUserId, Role.POWER_USER, fx.divA2Id)) ?? "",
      /access/i,
    );
  });

  it("SCOREKEEPER division scope matches assignments", async (t) => {
    if (!run || !fx) {
      t.skip("TEST_DATABASE_URL (or allowed disposable DATABASE_URL) not set");
      return;
    }
    assert.equal(await assertDivisionScope(fx.scorekeeperId, Role.SCOREKEEPER, fx.divA1Id), null);
    assert.match(
      (await assertDivisionScope(fx.scorekeeperId, Role.SCOREKEEPER, fx.divA2Id)) ?? "",
      /access/i,
    );
  });
});
