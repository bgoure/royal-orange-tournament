import { auth } from "@/auth";
import {
  TournamentHeadquartersForm,
  type HeadquartersLocationOption,
  type TournamentHeadquartersState,
} from "@/components/admin/tournament/TournamentHeadquartersForm";
import { can } from "@/lib/rbac/permissions";
import { formatLocationAddress } from "@/lib/location-utils";
import { getHeadquartersLocation, listLocations } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function AdminTournamentSettingsPage() {
  const session = await auth();
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-amber-900">No tournament selected</h1>
        <p className="mt-2 text-sm text-amber-800">
          Open the public site, choose a tournament from the switcher, then return here.
        </p>
      </div>
    );
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
    );
  }

  return (
    <TournamentHeadquartersForm
      headquarters={headquarters}
      locations={options}
      tournamentName={tournament.name}
      canManage={canManage}
    />
  );
}
