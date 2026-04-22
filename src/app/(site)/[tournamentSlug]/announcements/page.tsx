import { notFound } from "next/navigation";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { TournamentAnnouncementsPublic } from "@/app/(site)/public-pages/tournament-announcements-public";

export default async function TournamentAnnouncementsPage({
  params,
}: {
  params: Promise<{ tournamentSlug: string }>;
}) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament || !tournament.showPublicAnnouncements) {
    notFound();
  }

  return TournamentAnnouncementsPublic({ tournament });
}
