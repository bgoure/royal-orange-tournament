import type { Tournament } from "@prisma/client";
import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { PageTitle } from "@/components/ui/PublicHeading";
import { auth } from "@/auth";
import { listAnnouncements } from "@/lib/services/announcements";

export async function TournamentAnnouncementsPublic({ tournament }: { tournament: Tournament }) {
  const [items, session] = await Promise.all([listAnnouncements(tournament.id), auth()]);
  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "POWER_USER";
  const canDelete = role === "ADMIN";

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Announcements</PageTitle>
      <AnnouncementList
        items={items}
        adminEditable={canEdit}
        canDelete={canDelete}
        tournamentSlug={tournament.slug}
      />
    </div>
  );
}
