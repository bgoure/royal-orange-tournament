import { redirect } from "next/navigation";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function FaqRedirectPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) redirect("/");
  redirect(tournamentPathFromBase(tournamentPublicBasePath(tournament), "rules"));
}
