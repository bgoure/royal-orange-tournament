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
  firstRoundSlotsForOba4,
  gamesForOba5Seeded,
  gamesForOba6Seeded,
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

  it("5-team map is Round 1–7 with only 4 vs 5 in Round 1", () => {
    const games = gamesForOba5Seeded(["s1", "s2", "s3", "s4", "s5"]);
    const names = [...new Set(games.map((g) => g.roundName))];
    assert.ok(names.includes("Round 1"));
    assert.ok(names.includes("Round 4"));
    assert.ok(names.includes("Championship"));
    assert.equal(games.filter((g) => g.roundName === "Round 1").length, 1);
    assert.equal(games.filter((g) => g.roundName === "Round 2").length, 2);
  });

  it("6-team map is Round 1–6 with two Round 1 games and implicit byes", () => {
    const games = gamesForOba6Seeded(["s1", "s2", "s3", "s4", "s5", "s6"]);
    assert.equal(games.filter((g) => g.roundName === "Round 1").length, 2);
    assert.equal(games.filter((g) => g.roundName === "Round 2").length, 4);
    assert.ok(games.every((g) => g.home.kind !== "bye" && g.away.kind !== "bye"));
    assert.equal(games.find((g) => g.key === "GF2")?.gameNumber, "11");
  });
});
