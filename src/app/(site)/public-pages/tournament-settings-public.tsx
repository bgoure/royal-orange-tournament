import type { Role, Tournament } from "@prisma/client";
import { PageTitle } from "@/components/ui/PublicHeading";
import { PublicSettingsPortal } from "@/components/settings/PublicSettingsPortal";
import { auth } from "@/auth";
import { getRequestPublicOrigin } from "@/lib/request-public-origin";
import { can } from "@/lib/rbac/permissions";
import { listBracketProgressForPublicSettings } from "@/lib/services/bracket-public-settings";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";

const googleAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) && Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

export async function TournamentSettingsPublic({ tournament }: { tournament: Tournament }) {
  const requestOrigin = await getRequestPublicOrigin();
  const session = await auth();
  const user = session?.user;
  const signedIn = Boolean(user?.id);
  const userLabel = user ? (user.name?.trim() || user.email?.trim() || "Signed in") : "";
  const role = (user?.role ?? "PUBLIC") as Role;
  const showBracketProgressSection =
    signedIn && (can(role, "bracket:configure") || can(role, "bracket:pushAndReset"));
  const bracketProgressRows =
    showBracketProgressSection && user?.id
      ? await listBracketProgressForPublicSettings(tournament.id, user.id, role)
      : [];
  const publicBasePath = tournamentPublicBasePath(tournament);
  const settingsPath = tournamentPathFromBase(publicBasePath, "settings");

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Settings</PageTitle>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Change how this site looks on your device. Staff sign-in tools are below if you help run the tournament.
      </p>

      <PublicSettingsPortal
        settingsPath={settingsPath}
        requestOrigin={requestOrigin}
        googleAuthConfigured={googleAuthConfigured}
        signedIn={signedIn}
        userLabel={userLabel}
        role={role}
        tournamentId={tournament.id}
        showBracketProgressSection={showBracketProgressSection}
        bracketProgressRows={bracketProgressRows}
      />
    </div>
  );
}
