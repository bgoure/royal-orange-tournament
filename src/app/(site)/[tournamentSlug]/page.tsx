import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentHomePublic } from "@/app/(site)/public-pages/tournament-home";

export default async function TournamentHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentSlug: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) return null;
  return TournamentHomePublic({ tournament, searchParams: await searchParams });
}
