"use client";

import { useActionState } from "react";
import {
  updateBracketFeederAction,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";

export type FeederMatchRow = {
  id: string;
  label: string;
  homeFromMatchId: string | null;
  awayFromMatchId: string | null;
  homeFromKind: "WINNER" | "LOSER" | null;
  awayFromKind: "WINNER" | "LOSER" | null;
  loserDropMatchId: string | null;
};

export function BracketFeederEditor({
  bracketName,
  matches,
}: {
  bracketName: string;
  matches: FeederMatchRow[];
}) {
  const [state, action, pending] = useActionState(
    updateBracketFeederAction,
    undefined as BracketActionResult | undefined,
  );

  if (matches.length === 0) return null;

  const options = matches.map((m) => (
    <option key={m.id} value={m.id}>
      {m.label}
    </option>
  ));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Custom feeders · {bracketName}</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Override who feeds each seat (winner/loser of another game) and where losers drop. Leave blank
        to keep classic auto paths. Use this for poster-style 9/27 maps.
      </p>
      <ActionMessage state={state} />
      <ul className="mt-4 flex flex-col gap-3">
        {matches.map((m) => (
          <li key={m.id} className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
            <p className="text-xs font-semibold text-zinc-800">{m.label}</p>
            <form action={action} className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="matchId" value={m.id} />
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Home from
                <select
                  name="homeFromMatchId"
                  defaultValue={m.homeFromMatchId ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">(classic)</option>
                  {options}
                </select>
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Home kind
                <select
                  name="homeFromKind"
                  defaultValue={m.homeFromKind ?? "WINNER"}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="WINNER">Winner</option>
                  <option value="LOSER">Loser</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Away from
                <select
                  name="awayFromMatchId"
                  defaultValue={m.awayFromMatchId ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">(classic)</option>
                  {options}
                </select>
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Away kind
                <select
                  name="awayFromKind"
                  defaultValue={m.awayFromKind ?? "WINNER"}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="WINNER">Winner</option>
                  <option value="LOSER">Loser</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
                Loser drops to
                <select
                  name="loserDropMatchId"
                  defaultValue={m.loserDropMatchId ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">(classic / computed)</option>
                  {options}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save feeders"}
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
