import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bracketExportBasename, bracketExportSubtitle, fitScale } from "./bracket-export";

describe("bracket export helpers", () => {
  it("scales small trees up and large trees down to fill the page box", () => {
    assert.equal(fitScale(400, 200, 800, 400), 2);
    assert.equal(fitScale(1600, 400, 800, 400), 0.5);
    assert.equal(fitScale(800, 800, 800, 400), 0.5);
  });

  it("builds a safe download basename", () => {
    assert.equal(
      bracketExportBasename({ tournamentName: "Royal Orange Classic 2026", divisionName: "10U" }),
      "royal-orange-classic-2026-10u-bracket",
    );
  });

  it("drops a duplicate division prefix from the export subtitle", () => {
    assert.equal(bracketExportSubtitle("AAA", "AAA PLAYOFFS"), "AAA PLAYOFFS");
    assert.equal(bracketExportSubtitle("10U", "Playoffs"), "10U · Playoffs");
    assert.equal(bracketExportSubtitle("AAA", "AAA"), "AAA");
  });
});
