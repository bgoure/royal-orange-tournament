import { PageTitle } from "@/components/ui/PublicHeading";
import { PublicSettingsStaffAuth } from "@/components/settings/PublicSettingsStaffAuth";
import { auth } from "@/auth";
import { getRequestPublicOrigin } from "@/lib/request-public-origin";

const googleAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) && Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

export default async function SettingsPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const requestOrigin = await getRequestPublicOrigin();
  const session = await auth();
  const user = session?.user;
  const signedIn = Boolean(user?.id);
  const userLabel = user ? (user.name?.trim() || user.email?.trim() || "Signed in") : "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Settings</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">Preferences for the tournament tracker app.</p>
      </div>

      <PublicSettingsStaffAuth
        tournamentSlug={tournamentSlug}
        requestOrigin={requestOrigin}
        googleAuthConfigured={googleAuthConfigured}
        signedIn={signedIn}
        userLabel={userLabel}
        role={user?.role ?? "PUBLIC"}
      />
    </div>
  );
}
