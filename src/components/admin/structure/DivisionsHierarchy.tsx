"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Tournament } from "@prisma/client";
import type { Division, Pool, Team } from "@prisma/client";
import {
  createDivision,
  createPool,
  deleteDivision,
  deletePool,
  updateDivision,
  updatePool,
  type ActionResult,
} from "@/app/admin/_actions/structure";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";

type DivisionWithPools = Division & {
  pools: (Pool & { teams: Team[] })[];
};

type Props = {
  tournament: Tournament & { divisions: DivisionWithPools[] };
  isAdmin: boolean;
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

export function DivisionsHierarchy({ tournament, isAdmin }: Props) {
  const [divState, divAction, divPending] = useActionState(createDivision, undefined as ActionResult | undefined);
  const [poolState, poolAction, poolPending] = useActionState(createPool, undefined as ActionResult | undefined);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{tournament.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Hierarchy: divisions → pools → teams.{" "}
            <Link href="/" className="font-medium text-emerald-700 hover:underline">
              Switch tournament
            </Link>{" "}
            on the public site if needed.
          </p>
        </div>
        <Link href="/admin/teams" className={`${btnSecondary} inline-flex items-center`}>
          Manage all teams →
        </Link>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Add division</h2>
        <ActionMessage state={divState} />
        <form action={divAction} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="new-div-name" className={labelClass}>
              Name
            </label>
            <input id="new-div-name" name="name" required placeholder="e.g. 10U" className={formClass} />
          </div>
          <div className="w-28">
            <label htmlFor="new-div-sort" className={labelClass}>
              Sort
            </label>
            <input
              id="new-div-sort"
              name="sortOrder"
              type="number"
              className={formClass}
              placeholder="auto"
            />
          </div>
          <button type="submit" disabled={divPending} className={btnPrimary}>
            {divPending ? "Saving…" : "Create division"}
          </button>
        </form>
      </section>

      {tournament.divisions.length === 0 ? (
        <p className="text-sm text-zinc-500">No divisions yet. Create one above.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {tournament.divisions.map((division) => (
            <DivisionCard key={division.id} division={division} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Add pool</h2>
        <p className="mt-1 text-xs text-zinc-500">Choose the division this pool belongs to.</p>
        <ActionMessage state={poolState} />
        <form action={poolAction} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label htmlFor="pool-division" className={labelClass}>
              Division
            </label>
            <select id="pool-division" name="divisionId" required className={formClass}>
              <option value="">Select…</option>
              {tournament.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="pool-name" className={labelClass}>
              Pool name
            </label>
            <input id="pool-name" name="name" required placeholder="e.g. Royal" className={formClass} />
          </div>
          <div className="w-28">
            <label htmlFor="pool-sort" className={labelClass}>
              Sort
            </label>
            <input id="pool-sort" name="sortOrder" type="number" className={formClass} placeholder="auto" />
          </div>
          <button type="submit" disabled={poolPending} className={btnPrimary}>
            {poolPending ? "Saving…" : "Create pool"}
          </button>
        </form>
      </section>
    </div>
  );
}

function DivisionCard({
  division,
  isAdmin,
}: {
  division: DivisionWithPools;
  isAdmin: boolean;
}) {
  const [updState, updAction, updPending] = useActionState(updateDivision, undefined as ActionResult | undefined);
  const [delState, delAction, delPending] = useActionState(deleteDivision, undefined as ActionResult | undefined);

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 bg-zinc-50 px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Division</p>
          <h3 className="text-lg font-semibold text-zinc-900">{division.name}</h3>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <ConfirmForm
              message={`Delete division “${division.name}” and all pools, teams, and related pool data? This cannot be undone.`}
              action={delAction}
              className="inline"
            >
              <input type="hidden" name="id" value={division.id} />
              <button type="submit" disabled={delPending} className={btnDanger}>
                Delete division
              </button>
            </ConfirmForm>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <ActionMessage state={updState} />
        <ActionMessage state={delState} />
        <form action={updAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={division.id} />
          <div className="min-w-[200px] flex-1">
            <label className={labelClass}>Edit name</label>
            <input name="name" required defaultValue={division.name} className={formClass} />
          </div>
          <div className="w-28">
            <label className={labelClass}>Sort</label>
            <input
              name="sortOrder"
              type="number"
              required
              defaultValue={division.sortOrder}
              className={formClass}
            />
          </div>
          <button type="submit" disabled={updPending} className={btnSecondary}>
            {updPending ? "Saving…" : "Save division"}
          </button>
        </form>
      </div>

      <div className="border-t border-zinc-100 px-5 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pools</h4>
        {division.pools.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No pools in this division yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4">Pool</th>
                  <th className="py-2 pr-4">Sort</th>
                  <th className="py-2 pr-4">Teams</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {division.pools.map((pool) => (
                  <PoolRow key={pool.id} pool={pool} isAdmin={isAdmin} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}

function PoolRow({
  pool,
  isAdmin,
}: {
  pool: Pool & { teams: Team[] };
  isAdmin: boolean;
}) {
  const [updState, updAction, updPending] = useActionState(updatePool, undefined as ActionResult | undefined);
  const [delState, delAction, delPending] = useActionState(deletePool, undefined as ActionResult | undefined);

  return (
    <>
      <tr className="align-top">
        <td className="py-3 pr-4 font-medium text-zinc-900">{pool.name}</td>
        <td className="py-3 pr-4 tabular-nums text-zinc-600">{pool.sortOrder}</td>
        <td className="py-3 pr-4 text-zinc-600">{pool.teams.length}</td>
        <td className="py-3">
          {isAdmin ? (
            <ConfirmForm
              message={`Delete pool “${pool.name}” and all teams in it? Games referencing those teams will be removed.`}
              action={delAction}
              className="inline"
            >
              <input type="hidden" name="id" value={pool.id} />
              <button type="submit" disabled={delPending} className="text-sm font-medium text-red-700 hover:underline">
                Delete pool
              </button>
            </ConfirmForm>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={4} className="px-0 pb-4 pt-0">
          <ActionMessage state={updState} />
          <ActionMessage state={delState} />
          <form action={updAction} className="flex flex-wrap items-end gap-2 rounded-lg bg-zinc-50 p-3">
            <input type="hidden" name="id" value={pool.id} />
            <div className="min-w-[140px]">
              <label className={labelClass}>Name</label>
              <input name="name" required defaultValue={pool.name} className={formClass} />
            </div>
            <div className="w-24">
              <label className={labelClass}>Sort</label>
              <input name="sortOrder" type="number" required defaultValue={pool.sortOrder} className={formClass} />
            </div>
            <button type="submit" disabled={updPending} className={btnSecondary}>
              {updPending ? "…" : "Save pool"}
            </button>
          </form>
          {pool.teams.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
              {pool.teams.map((t) => (
                <li key={t.id} className="rounded-full bg-zinc-100 px-2 py-1">
                  {t.name}
                </li>
              ))}
            </ul>
          ) : null}
        </td>
      </tr>
    </>
  );
}
