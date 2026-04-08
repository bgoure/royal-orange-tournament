"use client";

import type { ActionResult } from "@/app/admin/_actions/structure";

export function ActionMessage({ state }: { state: ActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
      {state.error}
    </p>
  );
}
