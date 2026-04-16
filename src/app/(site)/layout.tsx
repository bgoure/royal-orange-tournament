import { SiteShell } from "@/components/layout/SiteShell";

/** Avoid serving a cached layout shell so the header always matches the latest deploy. */
export const dynamic = "force-dynamic";

export default function SiteGroupLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
