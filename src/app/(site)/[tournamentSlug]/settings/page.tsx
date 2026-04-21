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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b-2 border-royal pb-2 text-base font-bold uppercase tracking-[0.05em] text-royal">
          Display
        </h2>
        <p className="text-sm text-zinc-600">
          Times follow your device timezone. Tournament dates use the schedule published by the organizer.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b-2 border-royal pb-2 text-base font-bold uppercase tracking-[0.05em] text-royal">
          Notifications
        </h2>
        <p className="text-sm text-zinc-600">Email notifications are not configured in this public build.</p>
      </section>

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
