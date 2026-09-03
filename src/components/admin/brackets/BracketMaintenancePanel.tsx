"use client";

import { FormSection } from "@/components/admin/ui/FormSection";

type Props = {
  action: (payload: FormData) => void;
  pending: boolean;
};

/**
 * One-off repair for brackets created before the OBA 5/6-team round layout
 * change. Idempotent — brackets already on the new layout are skipped.
 */
export function BracketMaintenancePanel({ action, pending }: Props) {
  return (
    <FormSection
      title="Maintenance"
      description="Re-applies the OBA 5- and 6-team workbook round layout to brackets created before the layout change. Safe to run more than once — brackets already on the new layout are skipped. Public pages never run this on their own."
    >
      <form action={action}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "Repairing…" : "Repair OBA round groupings"}
        </button>
      </form>
    </FormSection>
  );
}
