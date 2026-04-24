import type { Tournament } from "@prisma/client";
import { PageTitle } from "@/components/ui/PublicHeading";
import { PublicSettingsPortal } from "@/components/settings/PublicSettingsPortal";
import { auth } from "@/auth";
import { getRequestPublicOrigin } from "@/lib/request-public-origin";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";

const googleAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) && Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

export async function TournamentSettingsPublic({ tournament }: { tournament: Tournament }) {
  const requestOrigin = await getRequestPublicOrigin();
  const session = await auth();
  const user = session?.user;
  const signedIn = Boolean(user?.id);
  const userLabel = user ? (user.name?.trim() || user.email?.trim() || "Signed in") : "";
  const publicBasePath = tournamentPublicBasePath(tournament);
  const settingsPath = tournamentPathFromBase(publicBasePath, "settings");

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Settings</PageTitle>

      <PublicSettingsPortal
        settingsPath={settingsPath}
        requestOrigin={requestOrigin}
        googleAuthConfigured={googleAuthConfigured}
        signedIn={signedIn}
        userLabel={userLabel}
        role={user?.role ?? "PUBLIC"}
      />
    </div>
  );
}
