/**
 * OBA (Baseball Ontario) double-elimination presets for small fields.
 * Sourced from the OBA Tournament Double Elimination Bracket workbook (5–20)
 * plus a classic 4-team DE map (workbook starts at 5).
 *
 * Bye constitution details: Baseball Ontario Constitution §P5 / RP5.2 n.
 */

export type ObaDePresetKey = "oba_de_4" | "oba_de_5" | "oba_de_6" | "oba_de_7" | "oba_de_12" | "oba_de_13";

/**
 * Documented OBA bye-seed game numbers (home seat). Runtime placement discovers seats from
 * feeder wiring via `listBracketImplicitSeedSeats` so custom maps get the same behavior.
 */
export type ObaImplicitByeSeedTarget = {
  /** 1-based seed rank among bye recipients (seed 1 first). */
  seedRank: number;
  gameNumber: string;
  /** Short admin label. */
  label: string;
};

/** Expected OBA sit-out seats (for docs/tests). Prefer feeder discovery at runtime. */
export function obaImplicitByeSeedTargets(
  presetKey: string | null | undefined,
): ObaImplicitByeSeedTarget[] {
  switch (presetKey) {
    case "oba_de_5":
      return [{ seedRank: 1, gameNumber: "3", label: "Seed 1 → G3 (Round 2)" }];
    case "oba_de_6":
      return [
        { seedRank: 1, gameNumber: "3", label: "Seed 1 → G3 (Round 2)" },
        { seedRank: 2, gameNumber: "4", label: "Seed 2 → G4 (Round 2)" },
      ];
    case "oba_de_7":
      return [{ seedRank: 1, gameNumber: "5", label: "Seed 1 → G5 (Round 2)" }];
    case "oba_de_12":
      return [];
    case "oba_de_13":
      return [{ seedRank: 1, gameNumber: "10", label: "Team 1 (draw) → G10 (Round 2)" }];
    default:
      return [];
  }
}

export type BracketFormatPresetKey =
  | "single_elim_classic"
  | "double_elim_classic"
  | ObaDePresetKey
  | "custom";

export type FormatExplainerSection = {
  title: string;
  body: string;
};

export type ObaDePreset = {
  key: ObaDePresetKey;
  /** Exact entrant count required. */
  teamCount: number;
  label: string;
  shortLabel: string;
  /** One-line summary for dropdowns. */
  summary: string;
  explainer: FormatExplainerSection[];
  /** Power-of-2 field when the preset builds a classic seeded tree. */
  classicEntrySize?: 4 | 8;
};

export const OBA_DE_PRESETS: Record<ObaDePresetKey, ObaDePreset> = {
  oba_de_4: {
    key: "oba_de_4",
    teamCount: 4,
    label: "OBA double elimination — 4 teams",
    shortLabel: "OBA DE · 4",
    summary: "Classic 4-team DE with if-necessary championship.",
    classicEntrySize: 4,
    explainer: [
      {
        title: "Overview",
        body: "Four teams, double elimination. One loss sends you to the losers side; a second loss eliminates you. Ends with an if-necessary grand final when the losers champion beats the undefeated team.",
      },
      {
        title: "Round 1",
        body: "Draw for pairings (two games). No first-round bye.",
      },
      {
        title: "Middle rounds",
        body: "Winners play winners; losers play losers. The losers-bracket winner meets the winners-bracket loser, then the survivors meet in the grand final.",
      },
      {
        title: "Branching endgame",
        body: "Grand final game 1: undefeated (winners final) vs losers champion. If the undefeated team wins, they are champions. If the losers champion wins, the same two teams play a sudden-death if-necessary game.",
      },
      {
        title: "Bye policy",
        body: "No structural byes at 4 teams. See Baseball Ontario Constitution §P5 for general bye rules in larger fields.",
      },
    ],
  },
  oba_de_5: {
    key: "oba_de_5",
    teamCount: 5,
    label: "Double elimination — 5 teams (seeded)",
    shortLabel: "DE · 5",
    summary: "Round 1–6 columns; R1 G1+G2; R2 G3+G4; seed 1 byes into G3; if-necessary final.",
    explainer: [
      {
        title: "Overview",
        body: "Five-team double elimination laid out in Round 1–6 columns (workbook style). Round 1 has two games (seeds 2–5); seed 1 receives a Round 1 bye into Game 3. A second loss eliminates a team.",
      },
      {
        title: "Round 1",
        body: "Game 1: 4th seed vs 5th seed. Game 2: 2nd seed vs 3rd seed.",
      },
      {
        title: "Round 2",
        body: "Game 3: 1st seed vs winner of Game 1. Game 4: loser of Game 1 vs loser of Game 2.",
      },
      {
        title: "Rounds 3–4",
        body: "Round 3 Game 5: winner of Game 4 vs loser of Game 3; Game 6: winner of Game 2 vs winner of Game 3. Round 4 Game 7: loser of Game 6 vs winner of Game 5.",
      },
      {
        title: "Rounds 5–6 (championship)",
        body: "Round 5 Game 8: winner of Game 6 (undefeated) vs winner of Game 7. Round 6 Game 9 is if-necessary when the losers champion wins Game 8.",
      },
      {
        title: "Seeding / byes",
        body: "Team list order is seed order (1 = strongest). Seed 1 sits out Round 1; seeds 2–5 play Games 1–2.",
      },
    ],
  },
  oba_de_6: {
    key: "oba_de_6",
    teamCount: 6,
    label: "Double elimination — 6 teams (seeded)",
    shortLabel: "DE · 6",
    summary: "Round 1–7 columns; seeds 1–2 bye; 4 vs 5 and 3 vs 6 open; if-necessary final.",
    explainer: [
      {
        title: "Overview",
        body: "Six-team double elimination laid out in Round 1–7 columns (workbook style). Seeds 1–2 receive a Round 1 bye; seeds 3–6 play Games 1–2. A second loss eliminates a team.",
      },
      {
        title: "Round 1",
        body: "Game 1: 4th seed vs 5th seed. Game 2: 3rd seed vs 6th seed.",
      },
      {
        title: "Round 2",
        body: "Game 3: 1st seed vs winner of Game 1. Game 4: 2nd seed vs winner of Game 2.",
      },
      {
        title: "Rounds 3–5",
        body: "Round 3 Game 5: loser of Game 4 vs loser of Game 1; Game 6: loser of Game 2 vs loser of Game 3; Game 8: winner of Game 3 vs winner of Game 4. Round 4 Game 7: winner of Game 5 vs winner of Game 6. Round 5 Game 9: winner of Game 7 vs loser of Game 8.",
      },
      {
        title: "Rounds 6–7 (championship)",
        body: "Round 6 Game 10: winner of Game 8 (undefeated path) vs winner of Game 9. Round 7 Game 11 is if-necessary when the losers champion wins Game 10.",
      },
      {
        title: "Seeding / byes",
        body: "Team list order is seed order (1 = strongest). Seeds 1–2 sit out Round 1; their first games are Games 3 and 4.",
      },
    ],
  },
  oba_de_7: {
    key: "oba_de_7",
    teamCount: 7,
    label: "Double elimination — 7 teams (seeded)",
    shortLabel: "DE · 7",
    summary: "Round 1–7 columns; seed 1 bye; 4 vs 5, 3 vs 6, 2 vs 7 open; if-necessary final.",
    explainer: [
      {
        title: "Overview",
        body: "Seven-team double elimination laid out in Round 1–7 columns (workbook style). Seed 1 receives a Round 1 bye into Game 5; seeds 2–7 play Games 1–3. A second loss eliminates a team.",
      },
      {
        title: "Round 1",
        body: "Game 1: 4th seed vs 5th seed. Game 2: 3rd seed vs 6th seed. Game 3: 2nd seed vs 7th seed.",
      },
      {
        title: "Round 2",
        body: "Game 5: 1st seed vs winner of Game 1. Game 6: winner of Game 2 vs winner of Game 3. Game 4: loser of Game 3 vs loser of Game 2.",
      },
      {
        title: "Rounds 3–5",
        body: "Round 3 Game 9: winner of Game 5 vs winner of Game 6; Game 7: winner of Game 4 vs loser of Game 1; Game 8: loser of Game 5 vs loser of Game 6. Round 4 Game 10: winner of Game 7 vs winner of Game 8. Round 5 Game 11: loser of Game 9 vs winner of Game 10.",
      },
      {
        title: "Rounds 6–7 (championship)",
        body: "Round 6 Game 12: winner of Game 9 (undefeated path) vs winner of Game 11. Round 7 Game 13 is if-necessary when the losers champion wins Game 12.",
      },
      {
        title: "Seeding / byes",
        body: "Team list order is seed order (1 = strongest). Seed 1 sits out Round 1; their first game is Game 5.",
      },
    ],
  },
  oba_de_12: {
    key: "oba_de_12",
    teamCount: 12,
    label: "Double elimination — 12 teams (OBA draw)",
    shortLabel: "DE · 12",
    summary:
      "Draw Round 1 (no bye). Fixed map through Round 4 including G19, then admin rematch-avoid redraw. Bracket A (2 remain) or B (3 remain).",
    explainer: [
      {
        title: "Overview",
        body: "Twelve-team double elimination from the OBA workbook. Round 1 is a draw: all 12 teams play Games 1–6 (first drawn plays, not a sit). A second loss eliminates a team. Rounds 1–4 use fixed winner/loser feeders. From Round 5, pairings are redrawn.",
      },
      {
        title: "Rounds 1–4 (fixed map)",
        body: "Round 1: Games 1–6 (no bye). Round 2: losers L1–L2, L3–L4, L5–L6; winners W1 vs W2, W3 vs W4, W5 vs W6. Round 3: W7 vs W8, W9 vs L10, L11 vs L12, W11 vs W12. Winner of Game 10 sits Round 3 and plays Game 19. Round 4: W13 vs W14, W15 vs L16, W10 vs W16.",
      },
      {
        title: "Round 5 (redraw)",
        body: "Four teams remain (W17, W18, W19, L19). Pair to avoid rematches where possible; otherwise a draw determines pairings. Admin confirms or overrides. Round 5 has no bye.",
      },
      {
        title: "Bracket A or B",
        body: "After Round 5, two teams remaining (undefeated survived) uses Bracket A. Three remaining (undefeated lost in Round 5; all have one loss) uses Bracket B. Unused games are hidden.",
      },
      {
        title: "Endgame",
        body: "Bracket A: Game 22A is W20 vs W21. Game 23A is if-necessary if the undefeated team loses 22A. Bracket B: RP5.2 bye + Game 22B, then Game 23B (W22B vs the bye) is always required — no if-necessary, all have one loss.",
      },
    ],
  },
  oba_de_13: {
    key: "oba_de_13",
    teamCount: 13,
    label: "Double elimination — 13 teams (OBA draw)",
    shortLabel: "DE · 13",
    summary:
      "Draw Round 1 (Team 1 bye). Fixed map through Round 4, then admin redraws (RP5.2 byes, rematch-avoid). Bracket A (3 remain) or B (4 remain).",
    explainer: [
      {
        title: "Overview",
        body: "Thirteen-team double elimination from the OBA workbook. Round 1 is a draw: first drawn sits (Team 1); the other 12 play Games 1–6. A second loss eliminates a team. Rounds 1–4 use fixed winner/loser feeders. From Round 5, pairings are redrawn.",
      },
      {
        title: "Rounds 1–4 (fixed map)",
        body: "Round 1: Team 1 bye, Games 1–6. Round 2: Winner of Game 1 sits; Team 1 vs W2, W3 vs W4, W5 vs W6; losers L1–L2, L3–L4, L5–L6. Round 3: L7/L8/L9 out; W7 vs W8, W9 vs L10, L11 vs L12, W1 vs W10, W11 vs W12. Round 4: L13/L14/L15 out; W13 sits; W14 vs W15, L16 vs L17, W16 vs W17.",
      },
      {
        title: "Round 5 (redraw)",
        body: "Five teams remain, one undefeated. The bye follows OBA RP5.2 (no back-to-back bye, no second bye until everyone has one, then prefer undefeated, then RP7.3/draw). The 4-0 path (no prior bye) therefore sits. The other four are paired to avoid rematches. Admin confirms or overrides.",
      },
      {
        title: "Bracket A or B",
        body: "After Round 5, three teams remaining (undefeated survived) uses Bracket A. Four remaining (undefeated lost in Round 5; all have one loss) uses Bracket B. Unused games are hidden. Admin places Round 6 (and Round 7 when three still remain in A).",
      },
      {
        title: "Endgame",
        body: "Bracket A: RP5.2 bye + Game 23A. If two remain, Game 24A is the final and Game 25A is if-necessary. If three remain, another RP5.2 bye (not the Round 6 bye team), Game 24A semi, then Game 25A vs the Round 7 bye. Bracket B: Games 23B and 24B, then Game 25B (W23B vs W24B) is the championship — no if-necessary, all have one loss.",
      },
    ],
  },
};

/** Feeder-wired OBA maps that skip classic W/L index math. */
export function isObaFeederMapPreset(key: string | null | undefined): boolean {
  return (
    key === "oba_de_5" ||
    key === "oba_de_6" ||
    key === "oba_de_7" ||
    key === "oba_de_12" ||
    key === "oba_de_13"
  );
}

export function isObaDePresetKey(key: string): key is ObaDePresetKey {
  return (
    key === "oba_de_4" ||
    key === "oba_de_5" ||
    key === "oba_de_6" ||
    key === "oba_de_7" ||
    key === "oba_de_12" ||
    key === "oba_de_13"
  );
}

export function getObaDePreset(key: ObaDePresetKey): ObaDePreset {
  return OBA_DE_PRESETS[key];
}

export function obaDePresetsForTeamCount(teamCount: number): ObaDePreset[] {
  return Object.values(OBA_DE_PRESETS).filter((p) => p.teamCount === teamCount);
}

/** Classic + OBA + custom options for the wizard dropdown. */
export type WizardFormatOption = {
  key: BracketFormatPresetKey;
  label: string;
  /** When set, option only applies if division team count equals this. */
  requiresTeamCount?: number;
  group: "classic" | "oba" | "custom";
};

export const WIZARD_FORMAT_OPTIONS: WizardFormatOption[] = [
  {
    key: "single_elim_classic",
    label: "Single elimination (classic)",
    group: "classic",
  },
  {
    key: "double_elim_classic",
    label: "Double elimination (classic power-of-2)",
    group: "classic",
  },
  {
    key: "oba_de_4",
    label: "OBA double elimination — 4 teams",
    requiresTeamCount: 4,
    group: "oba",
  },
  {
    key: "oba_de_5",
    label: "Double elimination — 5 teams (seeded)",
    requiresTeamCount: 5,
    group: "oba",
  },
  {
    key: "oba_de_6",
    label: "Double elimination — 6 teams (seeded)",
    requiresTeamCount: 6,
    group: "oba",
  },
  {
    key: "oba_de_7",
    label: "Double elimination — 7 teams (seeded)",
    requiresTeamCount: 7,
    group: "oba",
  },
  {
    key: "oba_de_12",
    label: "Double elimination — 12 teams (OBA draw)",
    requiresTeamCount: 12,
    group: "oba",
  },
  {
    key: "oba_de_13",
    label: "Double elimination — 13 teams (OBA draw)",
    requiresTeamCount: 13,
    group: "oba",
  },
  {
    key: "custom",
    label: "Custom — teams only, build later",
    group: "custom",
  },
];

export function wizardFormatOptionsForTeamCount(teamCount: number): WizardFormatOption[] {
  return WIZARD_FORMAT_OPTIONS.filter(
    (o) => o.requiresTeamCount == null || o.requiresTeamCount === teamCount,
  );
}

export function explainerForFormatPreset(
  key: BracketFormatPresetKey,
): FormatExplainerSection[] {
  if (isObaDePresetKey(key)) return OBA_DE_PRESETS[key].explainer;
  switch (key) {
    case "single_elim_classic":
      return [
        {
          title: "Overview",
          body: "Power-of-2 single elimination. Field is padded with BYEs so every round halves cleanly. One loss eliminates a team.",
        },
        {
          title: "Seeding",
          body: "Place teams in seed order (or auto from the list). Higher seeds receive first-round byes when the field is padded.",
        },
        {
          title: "Endgame",
          body: "Winners advance until a single championship game. No losers bracket and no if-necessary final.",
        },
      ];
    case "double_elim_classic":
      return [
        {
          title: "Overview",
          body: "Power-of-2 double elimination with a fixed winners/losers tree. Field padded with BYEs. A second loss eliminates a team.",
        },
        {
          title: "Pairing",
          body: "Classic fixed feeder paths (not OBA rematch-avoid redraws). You can switch pairing mode later under Admin → Brackets.",
        },
        {
          title: "Endgame",
          body: "Winners final vs losers final in a grand final. Wizard classic DE uses a single grand final unless you change grand-final mode in Brackets.",
        },
      ];
    case "custom":
      return [
        {
          title: "Overview",
          body: "Saves teams without creating a bracket template. Open Structure / Brackets afterward to build or seed the bracket yourself.",
        },
      ];
    default:
      return [];
  }
}
