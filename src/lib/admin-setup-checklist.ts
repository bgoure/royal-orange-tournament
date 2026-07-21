/** Client-side dismiss keys + shared step metadata for post-create setup. */

export const SETUP_CHECKLIST_DISMISS_PREFIX = "tourney-setup-dismiss:";

export function setupChecklistDismissKey(slug: string): string {
  return `${SETUP_CHECKLIST_DISMISS_PREFIX}${slug}`;
}

export type SetupStepId = "teams" | "fields" | "games" | "brackets";

export type SetupStepDef = {
  id: SetupStepId;
  title: string;
  description: string;
  href: string;
  optional?: boolean;
};

export const SETUP_STEPS: SetupStepDef[] = [
  {
    id: "teams",
    title: "Name teams",
    description: "Paste or rename placeholder teams in each pool.",
    href: "/admin/teams",
  },
  {
    id: "fields",
    title: "Confirm fields",
    description: "Field 1 was created with HQ — add more if needed.",
    href: "/admin/fields",
  },
  {
    id: "games",
    title: "Generate pool schedule",
    description: "Use round-robin generate or add pool games.",
    href: "/admin/games",
  },
  {
    id: "brackets",
    title: "Build playoffs",
    description: "Optional until pool play is underway.",
    href: "/admin/brackets",
    optional: true,
  },
];

export type SetupProgress = {
  teamsNamed: boolean;
  hasField: boolean;
  hasPoolGames: boolean;
  hasBracket: boolean;
};

export function isSetupStepDone(stepId: SetupStepId, progress: SetupProgress): boolean {
  switch (stepId) {
    case "teams":
      return progress.teamsNamed;
    case "fields":
      return progress.hasField;
    case "games":
      return progress.hasPoolGames;
    case "brackets":
      return progress.hasBracket;
  }
}

export function countIncompleteRequiredSteps(progress: SetupProgress): number {
  return SETUP_STEPS.filter((s) => !s.optional && !isSetupStepDone(s.id, progress)).length;
}

/** Wizard placeholders look like `10U · Pool A · Team 1`. */
export const PLACEHOLDER_TEAM_NAME_RE = /·\s*Team\s+\d+\s*$/i;
