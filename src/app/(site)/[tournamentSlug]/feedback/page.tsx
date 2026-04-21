import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { PageTitle } from "@/components/ui/PublicHeading";
import { tournamentPath } from "@/lib/tournament-public-path";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function FeedbackPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const sourcePath = tournamentPath(tournamentSlug, "feedback");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Feedback</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">
          Help improve this app for {tournament.name}. Share bugs, ideas, or general comments.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <FeedbackForm tournamentSlug={tournamentSlug} sourcePath={sourcePath} />
      </section>
    </div>
  );
}
