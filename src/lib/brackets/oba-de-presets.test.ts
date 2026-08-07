import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  explainerForFormatPreset,
  getObaDePreset,
  isObaDePresetKey,
  OBA_DE_PRESETS,
  wizardFormatOptionsForTeamCount,
} from "./oba-de-presets";
import {
  describeSeededFirstRound,
  firstRoundSlotsForOba4,
  firstRoundSlotsForSeededField,
} from "@/lib/services/oba-de-bracket-build";

describe("OBA DE presets", () => {
  it("defines 4–7 team presets with explainers", () => {
    for (const n of [4, 5, 6, 7] as const) {
      const key = `oba_de_${n}` as const;
      assert.equal(isObaDePresetKey(key), true);
      const p = getObaDePreset(key);
      assert.equal(p.teamCount, n);
      assert.ok(p.explainer.length >= 3);
      assert.ok(p.explainer.some((s) => /bye/i.test(s.title) || /bye/i.test(s.body)));
      assert.ok(
        p.explainer.some(
          (s) =>
            /endgame|bracket a|championship/i.test(s.title) ||
            /bracket a|if-necessary|championship/i.test(s.body),
        ),
      );
    }
    assert.equal(Object.keys(OBA_DE_PRESETS).length, 4);
  });

  it("filters wizard options by team count", () => {
    const five = wizardFormatOptionsForTeamCount(5).map((o) => o.key);
    assert.ok(five.includes("oba_de_5"));
    assert.ok(!five.includes("oba_de_4"));
    assert.ok(five.includes("double_elim_classic"));
    assert.ok(five.includes("custom"));
  });

  it("provides classic explainers", () => {
    assert.ok(explainerForFormatPreset("single_elim_classic").length > 0);
    assert.ok(explainerForFormatPreset("custom").length > 0);
  });

  it("builds 4-team first round as two games", () => {
    const slots = firstRoundSlotsForOba4(["a", "b", "c", "d"]);
    assert.equal(slots.length, 2);
    const ids = slots.flatMap((s) =>
      [s.home, s.away].map((side) => ("teamId" in side ? side.teamId : null)),
    );
    assert.deepEqual(new Set(ids.filter(Boolean)).size, 4);
  });

  it("5-team R1 is only seed 4 vs seed 5; seeds 1–3 have byes", () => {
    const pairs = describeSeededFirstRound(5, 8);
    assert.equal(pairs.length, 4);
    const real = pairs.filter((p) => p.home !== "BYE" && p.away !== "BYE");
    assert.equal(real.length, 1);
    const sides = [real[0]!.home, real[0]!.away].sort();
    assert.deepEqual(sides, ["Seed 4", "Seed 5"]);

    const byeOnly = pairs.filter((p) => p.home === "BYE" || p.away === "BYE");
    assert.equal(byeOnly.length, 3);
    const byeSeeds = byeOnly.map((p) => (p.home === "BYE" ? p.away : p.home)).sort();
    assert.deepEqual(byeSeeds, ["Seed 1", "Seed 2", "Seed 3"]);

    const slots = firstRoundSlotsForSeededField(["s1", "s2", "s3", "s4", "s5"], 8);
    assert.equal(slots.length, 4);
  });
});
