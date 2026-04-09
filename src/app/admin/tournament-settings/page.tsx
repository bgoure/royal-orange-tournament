import { auth } from "@/auth";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import {
  TournamentHeadquartersForm,
  type HeadquartersLocationOption,
  type TournamentHeadquartersState,
} from "@/components/admin/tournament/TournamentHeadquartersForm";
import { TournamentRenameForm } from "@/components/admin/tournament/TournamentRenameForm";
import { can } from "@/lib/rbac/permissions";
import { formatLocationAddress } from "@/lib/location-utils";
import { getHeadquartersLocation, listLocations } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";

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

  if (!headquarters) {
    return (
      <div className="flex flex-col gap-8">
        <TournamentRenameForm tournamentName={tournament.name} canManage={canManage} />
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <TournamentRenameForm tournamentName={tournament.name} canManage={canManage} />
      <TournamentHeadquartersForm
        headquarters={headquarters}
        locations={options}
        tournamentName={tournament.name}
        canManage={canManage}
      />
    </div>
  );
}
