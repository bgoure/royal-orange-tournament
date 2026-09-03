import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  /** Anchor target so nav shortcuts can deep-link into a long settings page. */
  id?: string;
  /** Right-aligned controls in the section header. */
  headerActions?: ReactNode;
  /** Footer row, typically an ActionBar with submit/cancel. */
  footer?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
  className?: string;
};

/** Card wrapper for a single group of admin settings or one form. */
export function FormSection({
  title,
  description,
  id,
  headerActions,
  footer,
  children,
  tone = "default",
  className = "",
}: Props) {
  const toneClass =
    tone === "danger" ? "border-red-200 bg-red-50/60" : "border-zinc-200 bg-white";
  return (
    <section
      id={id}
      className={`rounded-xl border ${toneClass} p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={`text-sm font-semibold ${
              tone === "danger" ? "text-red-900" : "text-zinc-900"
            }`}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs text-zinc-500">{description}</p>
          ) : null}
        </div>
        {headerActions ? <div className="flex flex-wrap gap-2">{headerActions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}
