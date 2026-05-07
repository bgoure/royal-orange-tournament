"use client";

import { usePathname } from "next/navigation";
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
  const pathname = usePathname() ?? "";
  const onHub = pathname === "/admin" || pathname === "/admin/";
  const showStrip = showTournamentStrip && !onHub;
  const isPrintSheets = pathname.startsWith("/admin/print-sheets");

  const mainInnerClass = isPrintSheets
    ? "mx-auto max-w-6xl px-8 py-10 print:w-full print:max-w-none print:px-0 print:py-0.5"
    : "mx-auto max-w-6xl px-8 py-10 print:max-w-none print:px-3 print:py-2";

  return (
    <CreateTournamentWizardProvider canCreateTournament={canCreateTournament}>
      <div className="flex min-h-full bg-zinc-100 print:block print:bg-white">
        <div className="print:hidden">
          <AdminSidebar />
        </div>
        <div className="flex min-h-full min-w-0 flex-1 flex-col print:w-full">
          {showStrip ? (
            <div className="print:hidden">
              <AdminTournamentStrip
                currentTournamentName={currentTournamentName}
                currentTournamentSlug={currentTournamentSlug}
              />
            </div>
          ) : null}
          <main className="flex-1 bg-white print:min-h-0 print:w-full print:min-w-0 print:overflow-x-clip">
            <div className={mainInnerClass}>{children}</div>
          </main>
        </div>
      </div>
    </CreateTournamentWizardProvider>
  );
}
