import type { Tournament } from "@prisma/client";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { PageTitle } from "@/components/ui/PublicHeading";
import { publicGlassCard2xl } from "@/lib/public-glass-card";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";

export async function TournamentFeedbackPublic({ tournament }: { tournament: Tournament }) {
  const publicBasePath = tournamentPublicBasePath(tournament);
  const sourcePath = tournamentPathFromBase(publicBasePath, "feedback");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Feedback</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">
          Help improve this app for {tournament.name}. Share bugs, ideas, or general comments.
        </p>
      </div>

      <section className={`p-4 sm:p-6 ${publicGlassCard2xl}`}>
        <FeedbackForm tournamentSlug={tournament.slug} sourcePath={sourcePath} />
      </section>
    </div>
  );
}
