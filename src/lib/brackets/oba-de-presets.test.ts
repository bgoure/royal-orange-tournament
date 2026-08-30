import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  explainerForFormatPreset,
  getObaDePreset,
  isObaDePresetKey,
  OBA_DE_PRESETS,
  obaImplicitByeSeedTargets,
  wizardFormatOptionsForTeamCount,
} from "./oba-de-presets";
import {
  firstRoundSlotsForOba4,
  gamesForOba5Seeded,
  gamesForOba6Seeded,
  gamesForOba7Seeded,
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
    assert.equal(Object.keys(OBA_DE_PRESETS).length, 6);
  });

  it("defines 12-team and 13-team draw presets", () => {
    assert.equal(isObaDePresetKey("oba_de_12"), true);
    assert.equal(getObaDePreset("oba_de_12").teamCount, 12);
    assert.equal(isObaDePresetKey("oba_de_13"), true);
    const p = getObaDePreset("oba_de_13");
    assert.equal(p.teamCount, 13);
    assert.ok(p.explainer.some((s) => /bracket a/i.test(s.title) || /bracket a/i.test(s.body)));
  });

  it("maps implicit bye seeds to Round 2 game numbers", () => {
    assert.deepEqual(
      obaImplicitByeSeedTargets("oba_de_6").map((t) => t.gameNumber),
      ["3", "4"],
    );
    assert.deepEqual(
      obaImplicitByeSeedTargets("oba_de_7").map((t) => t.gameNumber),
      ["5"],
    );
    assert.equal(obaImplicitByeSeedTargets("oba_de_4").length, 0);
  });

  it("filters wizard options by team count", () => {
    const five = wizardFormatOptionsForTeamCount(5).map((o) => o.key);
    assert.ok(five.includes("oba_de_5"));
    assert.ok(!five.includes("oba_de_4"));
    assert.ok(five.includes("double_elim_classic"));
    assert.ok(five.includes("custom"));
    const twelve = wizardFormatOptionsForTeamCount(12).map((o) => o.key);
    assert.ok(twelve.includes("oba_de_12"));
    assert.ok(!twelve.includes("oba_de_13"));
    const thirteen = wizardFormatOptionsForTeamCount(13).map((o) => o.key);
    assert.ok(thirteen.includes("oba_de_13"));
    assert.ok(!thirteen.includes("oba_de_5"));
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

  it("5-team map is Round 1–6 with G1+G2 in R1 and G3+G4 in R2", () => {
    const games = gamesForOba5Seeded(["s1", "s2", "s3", "s4", "s5"]);
    const names = [...new Set(games.map((g) => g.roundName))];
    assert.ok(names.includes("Round 1"));
    assert.ok(names.includes("Round 4"));
    assert.ok(names.includes("Championship"));
    assert.ok(!names.includes("Round 5"));
    assert.equal(games.filter((g) => g.roundName === "Round 1").length, 2);
    assert.equal(games.filter((g) => g.roundName === "Round 2").length, 2);
    assert.equal(games.filter((g) => g.roundName === "Round 3").length, 2);
    assert.equal(games.filter((g) => g.roundName === "Round 4").length, 1);
  });

  it("6-team map is Round 1–7 with G5/G6 in Round 3 (not Round 2)", () => {
    const games = gamesForOba6Seeded(["s1", "s2", "s3", "s4", "s5", "s6"]);
    assert.equal(games.filter((g) => g.roundName === "Round 1").length, 2);
    assert.equal(games.filter((g) => g.roundName === "Round 2").length, 2);
    assert.equal(games.filter((g) => g.roundName === "Round 3").length, 3);
    assert.equal(games.filter((g) => g.roundName === "Round 4").length, 1);
    assert.equal(games.filter((g) => g.roundName === "Round 5").length, 1);
    assert.equal(games.find((g) => g.key === "G5")?.roundName, "Round 3");
    assert.equal(games.find((g) => g.key === "G7")?.roundName, "Round 4");
    assert.equal(games.find((g) => g.key === "G9")?.roundName, "Round 5");
    assert.ok(games.every((g) => g.home.kind !== "bye" && g.away.kind !== "bye"));
    assert.equal(games.find((g) => g.key === "GF2")?.gameNumber, "11");
  });

  it("7-team map is Round 1–7 seeded workbook (no redraw slots)", () => {
    const games = gamesForOba7Seeded(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    assert.equal(games.filter((g) => g.roundName === "Round 1").length, 3);
    assert.equal(games.filter((g) => g.roundName === "Round 2").length, 3);
    assert.equal(games.filter((g) => g.roundName === "Round 3").length, 3);
    assert.equal(games.filter((g) => g.roundName === "Round 4").length, 1);
    assert.equal(games.filter((g) => g.roundName === "Round 5").length, 1);
    assert.equal(games.find((g) => g.key === "G5")?.roundName, "Round 2");
    assert.equal(games.find((g) => g.key === "G4")?.roundName, "Round 2");
    assert.equal(games.find((g) => g.key === "G10")?.roundName, "Round 4");
    assert.equal(games.find((g) => g.key === "G11")?.roundName, "Round 5");
    const g5 = games.find((g) => g.key === "G5")!;
    assert.equal(g5.home.kind, "team");
    if (g5.home.kind === "team") assert.equal(g5.home.teamId, "s1");
    assert.ok(games.every((g) => g.home.kind !== "open" || g.key === "GF2"));
    assert.ok(games.every((g) => g.home.kind !== "bye" && g.away.kind !== "bye"));
    assert.equal(games.find((g) => g.key === "GF1")?.gameNumber, "12");
    assert.equal(games.find((g) => g.key === "GF2")?.gameNumber, "13");
  });
});
