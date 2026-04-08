"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Division, Pool, Team } from "@prisma/client";
import {
  createTeam,
  deleteTeam,
  updateTeam,
  type ActionResult,
} from "@/app/admin/_actions/structure";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";

export type TeamWithRelations = Team & {
  pool: Pool & { division: Division };
};

export type PoolOption = {
  poolId: string;
  divisionId: string;
  label: string;
};

const formClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50";

type Props = {
  teams: TeamWithRelations[];
  poolOptions: PoolOption[];
  tournamentName: string;
  isAdmin: boolean;
};

export function TeamsAdmin({ teams, poolOptions, tournamentName, isAdmin }: Props) {
  const [createState, createAction, createPending] = useActionState(createTeam, undefined as ActionResult | undefined);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Teams</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </div>
        <Link href="/admin/divisions" className={`${btnSecondary} inline-flex items-center`}>
          ← Divisions &amp; pools
        </Link>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Add team</h2>
        <p className="mt-1 text-xs text-zinc-600">Every team must belong to a pool (and therefore a division).</p>
        <ActionMessage state={createState} />
        {poolOptions.length === 0 ? (
          <p className="mt-4 text-sm text-amber-800">
            Create at least one pool under <Link href="/admin/divisions" className="font-medium underline">Divisions</Link>{" "}
            before adding teams.
          </p>
        ) : (
          <form action={createAction} className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="team-pool" className={labelClass}>
                  Division / pool
                </label>
                <select id="team-pool" name="poolId" required className={formClass}>
                  <option value="">Select…</option>
                  {poolOptions.map((o) => (
                    <option key={o.poolId} value={o.poolId}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="team-name" className={labelClass}>
                  Team name
                </label>
                <input id="team-name" name="name" required className={formClass} placeholder="Lightning" />
              </div>
              <div>
                <label htmlFor="team-abbr" className={labelClass}>
                  Abbreviation
                </label>
                <input id="team-abbr" name="abbreviation" className={formClass} placeholder="LTN" maxLength={12} />
              </div>
              <div>
                <label htmlFor="team-seed" className={labelClass}>
                  Seed (optional)
                </label>
                <input id="team-seed" name="seed" type="number" min={0} className={formClass} placeholder="—" />
              </div>
            </div>
            <button type="submit" disabled={createPending} className={`${btnPrimary} w-fit`}>
              {createPending ? "Saving…" : "Create team"}
            </button>
          </form>
        )}
      </section>

      {teams.length === 0 ? (
        <p className="text-sm text-zinc-500">No teams yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Abbr</th>
                <th className="px-4 py-3">Seed</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3">Pool</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {teams.map((team) => (
                <TeamRow key={team.id} team={team} poolOptions={poolOptions} isAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeamRow({
  team,
  poolOptions,
  isAdmin,
}: {
  team: TeamWithRelations;
  poolOptions: PoolOption[];
  isAdmin: boolean;
}) {
  const [updState, updAction, updPending] = useActionState(updateTeam, undefined as ActionResult | undefined);
  const [delState, delAction, delPending] = useActionState(deleteTeam, undefined as ActionResult | undefined);
  const division = team.pool.division;

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-3 font-medium text-zinc-900">{team.name}</td>
        <td className="px-4 py-3 text-zinc-600">{team.abbreviation ?? "—"}</td>
        <td className="px-4 py-3 tabular-nums text-zinc-600">{team.seed ?? "—"}</td>
        <td className="px-4 py-3 text-zinc-600">{division.name}</td>
        <td className="px-4 py-3 text-zinc-600">{team.pool.name}</td>
        <td className="px-4 py-3">
          {isAdmin ? (
            <ConfirmForm
              message={`Delete team “${team.name}”? Related games may be removed.`}
              action={delAction}
              className="inline"
            >
              <input type="hidden" name="id" value={team.id} />
              <button type="submit" disabled={delPending} className={btnDanger}>
                Delete
              </button>
            </ConfirmForm>
          ) : (
            <span className="text-xs text-zinc-400">Admin only</span>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={6} className="bg-zinc-50/80 px-4 pb-4 pt-0">
          <ActionMessage state={updState} />
          <ActionMessage state={delState} />
          <form action={updAction} className="mt-2 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="id" value={team.id} />
            <div className="lg:col-span-2">
              <label className={labelClass}>Pool</label>
              <select name="poolId" required defaultValue={team.poolId} className={formClass}>
                {poolOptions.map((o) => (
                  <option key={o.poolId} value={o.poolId}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Name</label>
              <input name="name" required defaultValue={team.name} className={formClass} />
            </div>
            <div>
              <label className={labelClass}>Abbreviation</label>
              <input name="abbreviation" defaultValue={team.abbreviation ?? ""} className={formClass} />
            </div>
            <div>
              <label className={labelClass}>Seed</label>
              <input
                name="seed"
                type="number"
                min={0}
                defaultValue={team.seed ?? ""}
                className={formClass}
              />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={updPending} className={btnSecondary}>
                {updPending ? "Saving…" : "Save team"}
              </button>
            </div>
          </form>
        </td>
      </tr>
    </>
  );
}
