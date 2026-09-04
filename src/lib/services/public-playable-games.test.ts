import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicPlayableGame, publicPlayableGameClause } from "@/lib/services/public-playable-games";

describe("isPublicPlayableGame", () => {
  it("keeps pool / unlinked games visible", () => {
    assert.equal(isPublicPlayableGame({ bracketMatch: null }), true);
  });

  it("keeps real bracket matchups visible", () => {
    assert.equal(
      isPublicPlayableGame({ bracketMatch: { homeIsBye: false, awayIsBye: false } }),
      true,
    );
  });

  it("hides structural home byes", () => {
    assert.equal(
      isPublicPlayableGame({ bracketMatch: { homeIsBye: true, awayIsBye: false } }),
      false,
    );
  });

  it("hides structural away byes / sit-outs", () => {
    assert.equal(
      isPublicPlayableGame({ bracketMatch: { homeIsBye: false, awayIsBye: true } }),
      false,
    );
  });
});

describe("publicPlayableGameClause", () => {
  it("excludes BracketMatch rows flagged as a bye on either side", () => {
    assert.deepEqual(publicPlayableGameClause(), {
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
