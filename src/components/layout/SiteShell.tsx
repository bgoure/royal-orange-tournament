import { SiteHeader } from "@/components/layout/SiteHeader";
import { getTournamentForRequest } from "@/lib/tournament-context";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const tournament = await getTournamentForRequest();
  const headerSlug = tournament?.slug ?? "";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader currentSlug={headerSlug} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500">
        Tournament Hub — schedules, scores, and brackets
      </footer>
    </div>
  );
}
