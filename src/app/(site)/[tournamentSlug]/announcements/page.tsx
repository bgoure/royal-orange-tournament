import { notFound } from "next/navigation";
import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { PageTitle } from "@/components/ui/PublicHeading";
import { auth } from "@/auth";
import { listAnnouncements } from "@/lib/services/announcements";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

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

  const [items, session] = await Promise.all([listAnnouncements(tournament.id), auth()]);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Announcements</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">
          Newest updates first. Priority items appear at the top when published.
          {isAdmin ? (
            <>
              {" "}
              <span className="font-medium text-zinc-700">
                As an admin, tap a card to edit or delete without opening the admin portal.
              </span>
            </>
          ) : null}
        </p>
      </div>
      <AnnouncementList
        items={items}
        adminEditable={isAdmin}
        tournamentSlug={tournamentSlug}
      />
    </div>
  );
}
