import type { ReactNode } from "react";

type Props = {
  /** Small uppercase kicker above the title, e.g. "Tournament". */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One-line summary of what the page does. */
  description?: ReactNode;
  /** Secondary line for context such as timezone or counts. */
  meta?: ReactNode;
  /** Primary/secondary links or buttons, right aligned on wide screens. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared page masthead for /admin routes. Renders on the server unless the
 * caller passes interactive `actions`.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className = "",
}: Props) {
  return (
    <header
      className={`flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4 sm:gap-4 sm:pb-6 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-zinc-600">{description}</p> : null}
        {meta ? <p className="mt-1 text-xs text-zinc-500">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
