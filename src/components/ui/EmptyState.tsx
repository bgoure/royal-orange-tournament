import type { ReactNode } from "react";

/** shadcn-style empty pattern: icon, title, optional description + action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/90 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 text-royal [&>svg]:size-10 md:[&>svg]:size-11">{icon}</div>
      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-zinc-600 dark:text-zinc-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
