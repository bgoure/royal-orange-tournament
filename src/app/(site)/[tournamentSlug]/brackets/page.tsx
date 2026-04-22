import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentBracketsPublic } from "@/app/(site)/public-pages/tournament-brackets-public";

export default async function BracketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentSlug: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  const sp = await searchParams;

  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  return TournamentBracketsPublic({ tournament, searchParams: sp });
}
