import { SiteShell } from "@/components/layout/SiteShell";

export default function SiteGroupLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
