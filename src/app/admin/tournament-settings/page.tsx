import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import {
  TournamentHeadquartersForm,
  type HeadquartersLocationOption,
  type TournamentHeadquartersState,
} from "@/components/admin/tournament/TournamentHeadquartersForm";
import { TournamentDangerZoneForm } from "@/components/admin/tournament/TournamentDangerZoneForm";
import { TournamentPublishForm } from "@/components/admin/tournament/TournamentPublishForm";
import { TournamentRenameForm } from "@/components/admin/tournament/TournamentRenameForm";
import { TournamentSlugForm } from "@/components/admin/tournament/TournamentSlugForm";
import { TournamentPublicSwitcherOrderForm } from "@/components/admin/tournament/TournamentPublicSwitcherOrderForm";
import { TournamentBrandingForm } from "@/components/admin/tournament/TournamentBrandingForm";
import { TournamentPublicAnnouncementsForm } from "@/components/admin/tournament/TournamentPublicAnnouncementsForm";
import { AdminSetupChecklistStrip } from "@/components/admin/tournament/AdminSetupChecklistStrip";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { can } from "@/lib/rbac/permissions";
import { Role } from "@prisma/client";
import { formatLocationAddress } from "@/lib/location-utils";
import { getHeadquartersLocation, listLocations } from "@/lib/services/content";
import { getTournamentSetupProgress } from "@/lib/services/admin-setup-progress";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

/** Shown until a location exists to promote to headquarters. */
const EMPTY_HEADQUARTERS: TournamentHeadquartersState = {
  headquartersLocationId: "",
  name: "",
  address: "",
  latitude: null,
  longitude: null,
};

export default async function AdminTournamentSettingsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const [hq, locations, setupProgress] = await Promise.all([
    getHeadquartersLocation(tournament.id),
    listLocations(tournament.id),
    getTournamentSetupProgress(tournament.id),
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
    tournamentId: tournament.id,
    pwaIcon192Url: tournament.pwaIcon192Url,
    pwaIcon512Url: tournament.pwaIcon512Url,
    gameSheetLogoRightUrl: tournament.gameSheetLogoRightUrl,
    gameSheetHeaderLogoUpdatedAt: tournament.gameSheetHeaderLogo?.updatedAt.toISOString() ?? null,
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

  return (
    <div key={tournament.id} className="flex flex-col gap-8">
      <AdminPageHeader
        eyebrow="Tournament"
        title="Tournament Admin"
        description={
          <>
            Branding, headquarters, announcements, and archive tools for{" "}
            <strong>{tournament.name}</strong>.
          </>
        }
        actions={
          <StatusBadge tone={isArchived ? "warning" : tournament.isPublished ? "success" : "neutral"}>
            {isArchived ? "Archived" : tournament.isPublished ? "Live" : "Draft"}
          </StatusBadge>
        }
      />
      <div id="setup-progress">
        <AdminSetupChecklistStrip slug={tournament.slug} progress={setupProgress} variant="card" />
      </div>
      <div id="publish-tournament">
        <TournamentPublishForm
          isPublished={tournament.isPublished}
          tournamentName={tournament.name}
          publicSitePath={publicSitePath}
          canManage={canManage}
        />
      </div>
      <div id="tournament-info" className="flex flex-col gap-8">
        <TournamentRenameForm
          tournamentName={tournament.name}
          shortLabel={tournament.shortLabel}
          canManage={canManage}
        />
        <TournamentSlugForm tournamentSlug={tournament.slug} canManage={canManage} />
        <TournamentPublicSwitcherOrderForm
          publicSwitcherOrder={tournament.publicSwitcherOrder}
          tournamentSlug={tournament.slug}
          canManage={canManage}
        />
      </div>
      <TournamentPublicAnnouncementsForm
        showPublicAnnouncements={tournament.showPublicAnnouncements}
        tournamentName={tournament.name}
        canManage={canManage}
      />
      <TournamentBrandingForm branding={branding} canManage={canManage} />
      <TournamentHeadquartersForm
        headquarters={headquarters ?? EMPTY_HEADQUARTERS}
        locations={options}
        tournamentName={tournament.name}
        canManage={canManage}
      />
      <div id="danger-zone">
        <TournamentDangerZoneForm
          tournamentSlug={tournament.slug}
          tournamentName={tournament.name}
          publicSitePath={publicSitePath}
          isArchived={isArchived}
          canManage={canManage}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
