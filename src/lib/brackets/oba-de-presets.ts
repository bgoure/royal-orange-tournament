/**
 * OBA (Baseball Ontario) double-elimination presets for small fields.
 * Sourced from the OBA Tournament Double Elimination Bracket workbook (5–20)
 * plus a classic 4-team DE map (workbook starts at 5).
 *
 * Bye constitution details: Baseball Ontario Constitution §P5 / RP5.2 n.
 */

export type ObaDePresetKey = "oba_de_4" | "oba_de_5" | "oba_de_6" | "oba_de_7";

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
    summary: "Seeds 1–3 bye; seed 4 vs 5 opens; if-necessary championship.",
    classicEntrySize: 8,
    explainer: [
      {
        title: "Overview",
        body: "Five teams in an 8-slot double-elimination tree. Top three seeds receive first-round byes; only the 4th and 5th seeds play in Round 1. A second loss eliminates a team. Championship uses an if-necessary game when the losers champion beats the undefeated team.",
      },
      {
        title: "Round 1 (winners)",
        body: "Game 1: 4th seed vs 5th seed. Seeds 1, 2, and 3 each receive a bye into Round 2.",
      },
      {
        title: "Round 2 (winners)",
        body: "Game 2: 2nd seed vs 3rd seed. Game 3: 1st seed vs winner of Game 1.",
      },
      {
        title: "Winners final",
        body: "Game 5: winner of Game 2 vs winner of Game 3. Winner advances to the championship undefeated.",
      },
      {
        title: "Losers bracket",
        body: "Game 4: loser of Game 1 vs loser of Game 2. Game 6: winner of Game 4 vs loser of Game 3. Game 7 (losers final): winner of Game 6 vs loser of Game 5.",
      },
      {
        title: "Championship",
        body: "Game 8: winners-bracket champion vs losers-bracket champion. Game 9 (if necessary): played only if the losers champion wins Game 8 (first loss for the previously undefeated team).",
      },
      {
        title: "Seeding / byes",
        body: "Team list order is seed order (1 = strongest). Seeds 1–3 sit out Round 1; seed 4 plays seed 5.",
      },
    ],
  },
  oba_de_6: {
    key: "oba_de_6",
    teamCount: 6,
    label: "OBA double elimination — 6 teams",
    shortLabel: "OBA DE · 6",
    summary: "Fixed early map; Bracket A (4 left) or B (5 left) after Round 2.",
    explainer: [
      {
        title: "Overview",
        body: "Six-team OBA double elimination with a fixed early map, then a major branch after Round 2 depending on whether five or four teams remain.",
      },
      {
        title: "Rounds 1–2 (fixed)",
        body: "R1: Draw for pairings — three games (G1–G3). R2: L2 plays L3; W3 plays L1; W1 plays W2.",
      },
      {
        title: "Branch after Round 2",
        body: "Bracket A — if W5 is undefeated, four teams remain: W4 plays L6; W5 plays W6; then the undefeated (3–0) receives the bye and L8 plays W7; championship path with if-necessary. Bracket B — if W3 loses G5, five teams remain: undefeated (W6) gets the bye; match the other four avoiding rematches when possible (else draw); continue with bye draws and if-necessary final.",
      },
      {
        title: "Mid-bracket redraw",
        body: "On the B path (and later A/B endgames), pairings avoid previous match-ups when possible; otherwise a draw determines pairings. Bye draws use §P5 rules.",
      },
      {
        title: "Bye policy",
        body: "§P5 / RP5.2 n. (no back-to-back when avoidable; share first byes; prefer undefeated; else standings/draw).",
      },
    ],
  },
  oba_de_7: {
    key: "oba_de_7",
    teamCount: 7,
    label: "OBA double elimination — 7 teams",
    shortLabel: "OBA DE · 7",
    summary: "R1 bye by draw; Round 4 rematch-avoid redraw; Bracket A/B endgame.",
    explainer: [
      {
        title: "Overview",
        body: "Seven-team OBA double elimination. First team drawn receives the Round 1 bye. Round 4 re-pairs the remaining four; the endgame branches into Bracket A (2 left) or B (3 left).",
      },
      {
        title: "Rounds 1–3 (fixed)",
        body: "R1: Draw for pairings; first drawn gets the bye (three games among the other six). R2: L1 receives a Round 2 bye; L2 plays L3; Round 1 bye plays W1; W2 plays W3. R3: W4 plays L1; L5 plays L6; W5 plays W6 (L4 eliminated).",
      },
      {
        title: "Mid-bracket redraw (Round 4)",
        body: "L7 and L8 eliminated; four teams remain (one undefeated). Match the four avoiding previous match-ups when possible; otherwise draw for pairings.",
      },
      {
        title: "Branching endgame",
        body: "After Round 4, two or three teams remain. Bracket A (2 left): they play, then if-necessary championship if needed. Bracket B (3 left): draw for the bye among eligible teams; the other two play; then sudden-death championship.",
      },
      {
        title: "Bye policy",
        body: "§P5 / RP5.2 n. applies to all bye awards and draws.",
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
    label: "OBA double elimination — 6 teams",
    requiresTeamCount: 6,
    group: "oba",
  },
  {
    key: "oba_de_7",
    label: "OBA double elimination — 7 teams",
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
