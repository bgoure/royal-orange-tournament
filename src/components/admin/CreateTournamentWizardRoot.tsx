"use client";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTournamentStrip } from "@/components/admin/AdminTournamentStrip";
import { CreateTournamentWizardProvider } from "@/components/admin/tournament/CreateTournamentWizardContext";

type Props = {
  children: React.ReactNode;
  showTournamentStrip: boolean;
  canCreateTournament: boolean;
  currentTournamentName: string | null;
  currentTournamentSlug: string | null;
};

export function CreateTournamentWizardRoot({
  children,
  showTournamentStrip,
  canCreateTournament,
  currentTournamentName,
  currentTournamentSlug,
}: Props) {
  return (
    <CreateTournamentWizardProvider canCreateTournament={canCreateTournament}>
      <div className="flex min-h-full bg-zinc-100">
        <AdminSidebar />
        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          {showTournamentStrip ? (
            <AdminTournamentStrip
              currentTournamentName={currentTournamentName}
              currentTournamentSlug={currentTournamentSlug}
            />
          ) : null}
          <main className="flex-1 bg-white">
            <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
          </main>
        </div>
      </div>
    </CreateTournamentWizardProvider>
  );
}
