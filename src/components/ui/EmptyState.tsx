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
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/90 px-6 py-10 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 text-zinc-400 [&>svg]:size-10">{icon}</div>
      <p className="text-base font-medium text-zinc-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-zinc-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
