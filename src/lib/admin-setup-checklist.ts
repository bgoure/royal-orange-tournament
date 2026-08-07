/** Client-side dismiss keys + shared step metadata for post-create setup. */

import { WIZARD_DEFAULTS } from "@/lib/validations/tournament-wizard";

export const SETUP_CHECKLIST_DISMISS_PREFIX = "tourney-setup-dismiss:";

export function setupChecklistDismissKey(slug: string): string {
  return `${SETUP_CHECKLIST_DISMISS_PREFIX}${slug}`;
}

export type SetupStepId = "teams" | "fields" | "games" | "brackets" | "publish";

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
    description: "Rename placeholder teams (Division · Team N) if you skipped naming in the create wizard.",
    href: "/admin/teams#paste-team-names",
    ctaLabel: "Open teams",
  },
  {
    id: "fields",
    title: "Venue & fields",
    description: "Replace the TBD headquarters with a real venue, then add fields as needed.",
    href: "/admin/tournament-settings",
    ctaLabel: "Open settings",
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
  {
    id: "publish",
    title: "Publish tournament",
    description: "Drafts stay off the public site until you publish in settings.",
    href: "/admin/tournament-settings",
    ctaLabel: "Open settings",
  },
];

export type SetupProgress = {
  teamsNamed: boolean;
  /** Headquarters is not the wizard TBD placeholder. */
  hasVenue: boolean;
  hasField: boolean;
  hasPoolGames: boolean;
  hasBracket: boolean;
  isPublished: boolean;
};

export function isSetupStepDone(stepId: SetupStepId, progress: SetupProgress): boolean {
  switch (stepId) {
    case "teams":
      return progress.teamsNamed;
    case "fields":
      return progress.hasVenue;
    case "games":
      return progress.hasPoolGames;
    case "brackets":
      return progress.hasBracket;
    case "publish":
      return progress.isPublished;
  }
}

export const REQUIRED_SETUP_STEPS = SETUP_STEPS.filter((s) => !s.optional);

export function countIncompleteRequiredSteps(progress: SetupProgress): number {
  return REQUIRED_SETUP_STEPS.filter((s) => !isSetupStepDone(s.id, progress)).length;
}

export function countIncompleteSetupSteps(progress: SetupProgress): number {
  return SETUP_STEPS.filter((s) => !isSetupStepDone(s.id, progress)).length;
}

/** First incomplete step (required first, then optional), or null when everything is done. */
export function getNextSetupStep(progress: SetupProgress): {
  step: SetupStepDef;
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
  for (const step of SETUP_STEPS) {
    if (step.optional && !isSetupStepDone(step.id, progress)) {
      return { step, stepNumber: totalRequired, totalRequired };
    }
  }
  return null;
}

/** @deprecated Prefer getNextSetupStep — kept for call sites that only care about required. */
export function getNextRequiredSetupStep(progress: SetupProgress) {
  const totalRequired = REQUIRED_SETUP_STEPS.length;
  for (let i = 0; i < REQUIRED_SETUP_STEPS.length; i++) {
    const step = REQUIRED_SETUP_STEPS[i]!;
    if (!isSetupStepDone(step.id, progress)) {
      return { step, stepNumber: i + 1, totalRequired };
    }
  }
  return null;
}

export function countCompletedRequiredSteps(progress: SetupProgress): number {
  return REQUIRED_SETUP_STEPS.filter((s) => isSetupStepDone(s.id, progress)).length;
}

/** Wizard placeholders look like `10U · Team 1` (or legacy `10U · Pool A · Team 1`). */
export const PLACEHOLDER_TEAM_NAME_RE = /·\s*Team\s+\d+\s*$/i;

export function isWizardTbdVenue(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return n === "" || n === WIZARD_DEFAULTS.venueName.toLowerCase();
}
