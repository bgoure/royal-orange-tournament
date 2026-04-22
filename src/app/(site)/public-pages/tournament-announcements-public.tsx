import type { Tournament } from "@prisma/client";
import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { PageTitle } from "@/components/ui/PublicHeading";
import { auth } from "@/auth";
import { listAnnouncements } from "@/lib/services/announcements";

export async function TournamentAnnouncementsPublic({ tournament }: { tournament: Tournament }) {
  const [items, session] = await Promise.all([listAnnouncements(tournament.id), auth()]);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Announcements</PageTitle>
      <AnnouncementList items={items} adminEditable={isAdmin} tournamentSlug={tournament.slug} />
    </div>
  );
}
