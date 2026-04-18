import type { ReactNode } from "react";

/**
 * Public tournament headings (royal underline). Live/status motion elsewhere uses
 * `motion-safe:` / `motion-reduce:` so pulsing respects prefers-reduced-motion.
 */
const pageTitleClass =
  "border-b-2 border-royal pb-2 text-base font-bold uppercase tracking-[0.05em] text-royal md:text-xl";

const sectionTitleClass =
  "border-b-2 border-royal pb-2 text-base font-bold uppercase tracking-[0.05em] text-royal md:text-lg";

/** Top-of-page title for public tournament routes (semantic `h1`). */
export function PageTitle({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <h1 id={id} className={`${pageTitleClass} ${className}`.trim()}>
      {children}
    </h1>
  );
}

/** In-page section heading for public tournament routes (semantic `h2`). */
export function SectionTitle({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <h2 id={id} className={`${sectionTitleClass} ${className}`.trim()}>
      {children}
    </h2>
  );
}
