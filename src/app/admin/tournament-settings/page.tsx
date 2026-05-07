import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import {
  TournamentHeadquartersForm,
  type HeadquartersLocationOption,
  type TournamentHeadquartersState,
} from "@/components/admin/tournament/TournamentHeadquartersForm";
import { TournamentDangerZoneForm } from "@/components/admin/tournament/TournamentDangerZoneForm";
import { TournamentRenameForm } from "@/components/admin/tournament/TournamentRenameForm";
import { TournamentPublicSwitcherOrderForm } from "@/components/admin/tournament/TournamentPublicSwitcherOrderForm";
import { TournamentBrandingForm } from "@/components/admin/tournament/TournamentBrandingForm";
import { TournamentPublicAnnouncementsForm } from "@/components/admin/tournament/TournamentPublicAnnouncementsForm";
import { can } from "@/lib/rbac/permissions";
import { Role } from "@prisma/client";
import { formatLocationAddress } from "@/lib/location-utils";
import { getHeadquartersLocation, listLocations } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export default async function AdminTournamentSettingsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [hq, locations] = await Promise.all([
    getHeadquartersLocation(tournament.id),
    listLocations(tournament.id),
  ]);

  const options: HeadquartersLocationOption[] = locations.map((l) => ({
    id: l.id,
    name: l.name,
    addressLine: formatLocationAddress(l),
    latitude: l.latitude,
    longitude: l.longitude,
  }));

  const effectiveHq = hq ?? locations[0];
  const headquarters: TournamentHeadquartersState | null = effectiveHq
    ? {
        headquartersLocationId: effectiveHq.id,
        name: effectiveHq.name,
        address: effectiveHq.address ?? "",
        latitude: effectiveHq.latitude,
        longitude: effectiveHq.longitude,
      }
    : null;

  const role = session?.user?.role;
  const canManage = role != null && can(role, "content:manage");
  const isAdmin = role === Role.ADMIN;
  const isArchived = tournament.archivedAt != null;
  const publicSitePath = tournamentPublicBasePath(tournament);

  const branding = {
    pwaIcon192Url: tournament.pwaIcon192Url,
    pwaIcon512Url: tournament.pwaIcon512Url,
    gameSheetLogoRightUrl: tournament.gameSheetLogoRightUrl,
    pwaThemeColor: tournament.pwaThemeColor,
    socialWebsiteUrl: tournament.socialWebsiteUrl,
    socialFacebookUrl: tournament.socialFacebookUrl,
    socialInstagramUrl: tournament.socialInstagramUrl,
    socialXUrl: tournament.socialXUrl,
    socialYoutubeUrl: tournament.socialYoutubeUrl,
    socialEmail: tournament.socialEmail,
    socialShowWebsite: tournament.socialShowWebsite,
    socialShowFacebook: tournament.socialShowFacebook,
    socialShowInstagram: tournament.socialShowInstagram,
    socialShowX: tournament.socialShowX,
    socialShowYoutube: tournament.socialShowYoutube,
    socialShowEmail: tournament.socialShowEmail,
    socialWebsiteSubtext: tournament.socialWebsiteSubtext,
    socialFacebookSubtext: tournament.socialFacebookSubtext,
    socialInstagramSubtext: tournament.socialInstagramSubtext,
    socialXSubtext: tournament.socialXSubtext,
    socialYoutubeSubtext: tournament.socialYoutubeSubtext,
    socialEmailSubtext: tournament.socialEmailSubtext,
  };

  if (!headquarters) {
    return (
      <div className="flex flex-col gap-8">
        <header className="border-b border-zinc-200 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Tournament Admin</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Branding, headquarters, announcements, and archive tools for <strong>{tournament.name}</strong>.
          </p>
        </header>
        <TournamentRenameForm tournamentName={tournament.name} canManage={canManage} />
        <TournamentPublicSwitcherOrderForm
          publicSwitcherOrder={tournament.publicSwitcherOrder}
          tournamentSlug={tournament.slug}
          canManage={canManage}
        />
        <TournamentPublicAnnouncementsForm
          showPublicAnnouncements={tournament.showPublicAnnouncements}
          tournamentName={tournament.name}
          canManage={canManage}
        />
        <TournamentBrandingForm branding={branding} canManage={canManage} />
        <TournamentHeadquartersForm
          headquarters={{
            headquartersLocationId: "",
            name: "",
            address: "",
            latitude: null,
            longitude: null,
          }}
          locations={options}
          tournamentName={tournament.name}
          canManage={canManage}
        />
        <TournamentDangerZoneForm
          tournamentSlug={tournament.slug}
          tournamentName={tournament.name}
          publicSitePath={publicSitePath}
          isArchived={isArchived}
          canManage={canManage}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-zinc-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Tournament Admin</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Branding, headquarters, announcements, and archive tools for <strong>{tournament.name}</strong>.
        </p>
      </header>
      <TournamentRenameForm tournamentName={tournament.name} canManage={canManage} />
      <TournamentPublicSwitcherOrderForm
        publicSwitcherOrder={tournament.publicSwitcherOrder}
        tournamentSlug={tournament.slug}
        canManage={canManage}
      />
      <TournamentPublicAnnouncementsForm
        showPublicAnnouncements={tournament.showPublicAnnouncements}
        tournamentName={tournament.name}
        canManage={canManage}
      />
      <TournamentBrandingForm branding={branding} canManage={canManage} />
      <TournamentHeadquartersForm
        headquarters={headquarters}
        locations={options}
        tournamentName={tournament.name}
        canManage={canManage}
      />
      <TournamentDangerZoneForm
        tournamentSlug={tournament.slug}
        tournamentName={tournament.name}
        publicSitePath={publicSitePath}
        isArchived={isArchived}
        canManage={canManage}
        isAdmin={isAdmin}
      />
    </div>
  );
}
