import type { Tournament } from "@prisma/client";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import { listPoolsForDivisionTabs } from "@/lib/services/pools";

function deployShaLabel(): string {
  const full =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    "";
  if (!full) return "local";
  return full.slice(0, 7);
}

export async function SiteShell({
  children,
  tournament,
}: {
  children: React.ReactNode;
  tournament: Tournament;
}) {
  const sha = deployShaLabel();
  const slug = tournament.slug;

  const divisionTabDescriptors = await listPoolsForDivisionTabs(tournament.id).then(
    buildDivisionTabDescriptors,
  );

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader tournamentSlug={slug} divisionTabDescriptors={divisionTabDescriptors} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:pb-6">{children}</main>
      <footer className="hidden border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 md:block">
        Royal &amp; Orange 2026 — schedules, scores, and brackets
        <span className="mt-2 block font-mono text-[10px] text-zinc-400">Deploy {sha}</span>
      </footer>
      <p
        className="border-t border-zinc-200/80 bg-zinc-50/80 py-2 text-center font-mono text-[10px] text-zinc-400 md:hidden"
        title="Git commit for this deployment"
      >
        Deploy {sha}
      </p>
      <BottomNav tournamentSlug={slug} />
    </div>
  );
}
