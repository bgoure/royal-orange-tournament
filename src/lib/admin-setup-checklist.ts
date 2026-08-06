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
  ctaLabel: string;
  optional?: boolean;
};

export const SETUP_STEPS: SetupStepDef[] = [
  {
    id: "teams",
    title: "Name teams",
    description: "Rename placeholder teams if you skipped naming in the create wizard.",
    href: "/admin/teams",
    ctaLabel: "Open teams",
  },
  {
    id: "fields",
    title: "Venue & fields",
    description: "Optional for now — add headquarters, fields, and schedule windows when you’re ready.",
    href: "/admin/tournament-settings",
    ctaLabel: "Open settings",
    optional: true,
  },
  {
    id: "games",
    title: "Generate pool schedule",
    description: "Optional until you’re ready to schedule round-robin games.",
    href: "/admin/games",
    ctaLabel: "Open games",
    optional: true,
  },
  {
    id: "brackets",
    title: "Build playoffs",
    description: "Review or create playoff brackets per division.",
    href: "/admin/brackets",
    ctaLabel: "Open brackets",
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

export const REQUIRED_SETUP_STEPS = SETUP_STEPS.filter((s) => !s.optional);

export function countIncompleteRequiredSteps(progress: SetupProgress): number {
  return REQUIRED_SETUP_STEPS.filter((s) => !isSetupStepDone(s.id, progress)).length;
}

/** 1-based index of the first incomplete required step, or null if all required are done. */
export function getNextRequiredSetupStep(progress: SetupProgress): {
  step: SetupStepDef;
  /** 1-based position among required steps */
  stepNumber: number;
  totalRequired: number;
} | null {
  const totalRequired = REQUIRED_SETUP_STEPS.length;
  for (let i = 0; i < REQUIRED_SETUP_STEPS.length; i++) {
    const step = REQUIRED_SETUP_STEPS[i]!;
    if (!isSetupStepDone(step.id, progress)) {
      return { step, stepNumber: i + 1, totalRequired };
    }
  }
  return null;
}

/** How many required steps are complete (for “Step N of M” when highlighting next). */
export function countCompletedRequiredSteps(progress: SetupProgress): number {
  return REQUIRED_SETUP_STEPS.filter((s) => isSetupStepDone(s.id, progress)).length;
}

/** Wizard placeholders look like `10U · Pool A · Team 1`. */
export const PLACEHOLDER_TEAM_NAME_RE = /·\s*Team\s+\d+\s*$/i;
