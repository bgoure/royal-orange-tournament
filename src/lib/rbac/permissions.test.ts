import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, canAccessDivision } from "@/lib/rbac/permissions";

describe("RBAC permissions", () => {
  it("ADMIN can mutate games and configure brackets", () => {
    assert.equal(can("ADMIN", "game:create"), true);
    assert.equal(can("ADMIN", "game:update"), true);
    assert.equal(can("ADMIN", "bracket:configure"), true);
    assert.equal(can("ADMIN", "user:manageRoles"), true);
  });

  it("POWER_USER can score/create games but not configure brackets or manage users", () => {
    assert.equal(can("POWER_USER", "game:create"), true);
    assert.equal(can("POWER_USER", "game:update"), true);
    assert.equal(can("POWER_USER", "bracket:pushAndReset"), true);
    assert.equal(can("POWER_USER", "bracket:configure"), false);
    assert.equal(can("POWER_USER", "user:manageRoles"), false);
    assert.equal(can("POWER_USER", "content:manage"), false);
  });

  it("SCOREKEEPER can score but not create games or manage users", () => {
    assert.equal(can("SCOREKEEPER", "game:update"), true);
    assert.equal(can("SCOREKEEPER", "game:create"), false);
    assert.equal(can("SCOREKEEPER", "bracket:configure"), false);
    assert.equal(can("SCOREKEEPER", "user:manageRoles"), false);
  });

  it("PUBLIC cannot mutate", () => {
    assert.equal(can("PUBLIC", "game:read"), true);
    assert.equal(can("PUBLIC", "game:update"), false);
    assert.equal(can("PUBLIC", "game:create"), false);
  });
});

describe("canAccessDivision", () => {
  const assigned = new Set(["div-a", "div-b"]);

  it("ADMIN always passes", () => {
    assert.equal(canAccessDivision("ADMIN", new Set(), "div-x"), true);
  });

  it("POWER_USER and SCOREKEEPER only when assigned", () => {
    assert.equal(canAccessDivision("POWER_USER", assigned, "div-a"), true);
    assert.equal(canAccessDivision("SCOREKEEPER", assigned, "div-a"), true);
    assert.equal(canAccessDivision("POWER_USER", assigned, "div-x"), false);
    assert.equal(canAccessDivision("SCOREKEEPER", assigned, "div-x"), false);
  });

  it("PUBLIC never passes division scope", () => {
    assert.equal(canAccessDivision("PUBLIC", assigned, "div-a"), false);
  });
});
