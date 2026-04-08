"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CreateTournamentWizardModal } from "@/components/admin/tournament/CreateTournamentWizardModal";

type WizardCtx = { open: () => void; close: () => void; canCreateTournament: boolean };

const Ctx = createContext<WizardCtx | null>(null);

export function CreateTournamentWizardProvider({
  children,
  canCreateTournament,
}: {
  children: React.ReactNode;
  canCreateTournament: boolean;
}) {
  const [open, setOpen] = useState(false);
  const openWizard = useCallback(() => {
    if (canCreateTournament) setOpen(true);
  }, [canCreateTournament]);
  const closeWizard = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open: openWizard, close: closeWizard, canCreateTournament }),
    [openWizard, closeWizard, canCreateTournament],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {open ? <CreateTournamentWizardModal onClose={closeWizard} /> : null}
    </Ctx.Provider>
  );
}

export function useCreateTournamentWizard() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useCreateTournamentWizard must be used under CreateTournamentWizardProvider");
  }
  return ctx;
}
