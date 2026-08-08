/** Shared public-bracket layout tokens (current, past/archive, and newly created). */

/** Round column shell: grow with matchup cards; horizontal scroll when many rounds. */
export const BRACKET_ROUND_COLUMN_CLASS =
  "flex w-max min-w-[17.5rem] max-w-[28rem] shrink-0 flex-col";

/** Team / slot labels: wrap only at spaces — never mid-word. */
export const BRACKET_TEAM_NAME_CLASS = "break-normal [overflow-wrap:normal] [word-break:normal]";

export const BRACKET_COL_MIN_PX = 280;
export const BRACKET_COL_MAX_PX = 448; // 28rem
