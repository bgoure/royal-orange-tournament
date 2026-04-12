import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { listAnnouncements } from "@/lib/services/announcements";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AnnouncementsPage() {
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const announcements = await listAnnouncements(tournament.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Announcements</h1>
        <p className="text-sm text-zinc-600">All announcements for {tournament.name}.</p>
      </div>
      <AnnouncementList items={announcements} />
    </div>
  );
}
