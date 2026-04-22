/** Stroke icons aligned with bottom nav (24px, rounded caps). */

const cls = "size-6 shrink-0";

export function MoreIconAnnouncements() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden
    >
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 7.8l2.4 2.4" />
      <path d="M7 12h.01M7 16h.01" />
    </svg>
  );
}

export function MoreIconLocations() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden
    >
      <path d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}

export function MoreIconRules() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

export function MoreIconSocial() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

/** 8-tooth gear (alternating outer/inner radius) + hub — reads as cog at ~32px. */
export function MoreIconSettings() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-8 shrink-0"
      aria-hidden
    >
      <path d="M12 3l2.39 3.23 3.97-.59-.59 3.97L21 12l-3.23 2.39.59 3.97-3.97-.59L12 21l-2.39-3.23-3.97.59.59-3.97L3 12l3.23-2.39-.59-3.97 3.97.59L12 3z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function MoreIconFeedback() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden
    >
      <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}
