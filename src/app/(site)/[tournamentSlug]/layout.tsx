import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function TournamentSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tournamentSlug: string }>;
}) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) notFound();
  return <SiteShell tournament={tournament}>{children}</SiteShell>;
}
