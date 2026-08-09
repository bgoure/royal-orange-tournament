/**
 * OBA (Baseball Ontario) double-elimination presets for small fields.
 * Sourced from the OBA Tournament Double Elimination Bracket workbook (5–20)
 * plus a classic 4-team DE map (workbook starts at 5).
 *
 * Bye constitution details: Baseball Ontario Constitution §P5 / RP5.2 n.
 */

export type ObaDePresetKey = "oba_de_4" | "oba_de_5" | "oba_de_6" | "oba_de_7";

/** Implicit Round-1 bye seeds placed on later games (home seat) for seeded OBA maps. */
export type ObaImplicitByeSeedTarget = {
  /** 1-based seed rank among bye recipients (seed 1 first). */
  seedRank: number;
  gameNumber: string;
  /** Short admin label. */
  label: string;
};

/** Where sit-out / bye seeds must be written after Round 1 reseeding. */
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
};

export function isObaDePresetKey(key: string): key is ObaDePresetKey {
  return key === "oba_de_4" || key === "oba_de_5" || key === "oba_de_6" || key === "oba_de_7";
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
