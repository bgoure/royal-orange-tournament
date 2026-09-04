import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bracketFormatLabel,
  countTeamsInPools,
  divisionReadiness,
} from "./division-readiness";

describe("divisionReadiness", () => {
  it("asks for pools when none exist", () => {
    const r = divisionReadiness({ poolCount: 0, teamCount: 0, bracket: null });
    assert.equal(r.label, "Add pools");
    assert.equal(r.tone, "warning");
  });

  it("asks for teams when pools are empty", () => {
    const r = divisionReadiness({ poolCount: 2, teamCount: 0, bracket: null });
    assert.equal(r.label, "Needs teams");
  });

  it("reports pool play ready without a bracket", () => {
    const r = divisionReadiness({ poolCount: 1, teamCount: 4, bracket: null });
    assert.equal(r.label, "Pool play ready");
    assert.equal(r.formatLabel, null);
  });

  it("reports draft bracket with format", () => {
    const r = divisionReadiness({
      poolCount: 1,
      teamCount: 4,
      bracket: {
        format: "DOUBLE_ELIMINATION",
        published: false,
        name: "Playoffs",
        presetKey: null,
      },
    });
    assert.equal(r.label, "Bracket draft");
    assert.equal(r.formatLabel, "Double elim");
  });

  it("reports published bracket", () => {
    const r = divisionReadiness({
      poolCount: 1,
      teamCount: 4,
      bracket: {
        format: "SINGLE_ELIMINATION",
        published: true,
        name: "Playoffs",
        presetKey: null,
      },
    });
    assert.equal(r.label, "Bracket published");
    assert.equal(r.tone, "success");
  });
});

describe("bracketFormatLabel / countTeamsInPools", () => {
  it("labels known formats", () => {
    assert.equal(bracketFormatLabel("SINGLE_ELIMINATION"), "Single elim");
  });

  it("sums team counts", () => {
    assert.equal(
      countTeamsInPools([{ teams: [1, 2] }, { teams: [3] }]),
      3,
    );
  });
});
