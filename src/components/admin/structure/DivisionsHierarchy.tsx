"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from "react";
import Link from "next/link";
import type { BracketFormat, Division, Pool, Team, Tournament } from "@prisma/client";
import {
  createDivision,
  createPool,
  deleteDivision,
  deletePool,
  updateDivision,
  updatePool,
  type ActionResult,
} from "@/app/admin/_actions/structure";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { ActionBar } from "@/components/admin/ui/ActionBar";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { EntityEditorSheet } from "@/components/admin/ui/EntityEditorSheet";
import { StatusBadge, type StatusTone } from "@/components/admin/ui/StatusBadge";
import {
  createInitialEntitySheetState,
  entitySheetReducer,
  resolveEntityById,
} from "@/components/admin/ui/entity-sheet-session";
import {
  divisionDeleteConfirmDescription,
  divisionDeleteDangerHint,
  poolDeleteConfirmDescription,
  poolDeleteDangerHint,
} from "@/components/admin/structure/division-destructive-copy";
import {
  countTeamsInPools,
  divisionReadiness,
  type DivisionBracketSummary,
} from "@/components/admin/structure/division-readiness";
import { POOL_CARD_LABEL_OPTIONS, poolCardLabelTextClass } from "@/lib/pool-card-label";

type BracketRow = {
  format: BracketFormat;
  published: boolean;
  name: string;
  presetKey: string | null;
};

type DivisionWithPools = Division & {
  pools: (Pool & { teams: Team[] })[];
  brackets: BracketRow[];
};

type Props = {
  tournament: Tournament & { divisions: DivisionWithPools[] };
  isAdmin: boolean;
};

const formClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "inline-flex h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50";
const btnGhost =
  "inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50";

function ErrorBanner({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
      {message}
    </p>
  );
}

function firstBracket(division: DivisionWithPools): DivisionBracketSummary {
  const b = division.brackets[0];
  return b ?? null;
}

function cardLabelDisplay(value: string | null | undefined): string {
  if (!value) return "Default grey";
  return POOL_CARD_LABEL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function AddDivisionSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createDivision, undefined as ActionResult | undefined);

  useEffect(() => {
    if (!open) return;
    if (state?.ok) onClose();
  }, [state, open, onClose]);

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Add division"
      description="Age brackets or flight groups (e.g. 10U, 12U)."
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form="add-division-form" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Create division"}
          </button>
        </ActionBar>
      }
    >
      <ErrorBanner message={state && !state.ok ? state.error : undefined} />
      <form id="add-division-form" action={action} className="flex flex-col gap-5">
        <div>
          <label htmlFor="add-div-name" className={labelClass}>
            Name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input id="add-div-name" name="name" required className={formClass} placeholder="e.g. 10U" />
        </div>
        <div>
          <label htmlFor="add-div-sort" className={labelClass}>
            Sort order <span className="text-zinc-400">(optional)</span>
          </label>
          <input id="add-div-sort" name="sortOrder" type="number" className={formClass} placeholder="auto" />
        </div>
      </form>
    </EntityEditorSheet>
  );
}

function EditDivisionSheet({
  open,
  onClose,
  division,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  division: DivisionWithPools | null;
  isAdmin: boolean;
}) {
  const [updState, updAction, updPending] = useActionState(updateDivision, undefined as ActionResult | undefined);
  const [delState, delAction, delPending] = useActionState(deleteDivision, undefined as ActionResult | undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [display, setDisplay] = useState(division);
  if (division != null && division !== display) setDisplay(division);

  useEffect(() => {
    if (!open) return;
    if (updState?.ok) onClose();
  }, [updState, open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (delState?.ok) onClose();
  }, [delState, open, onClose]);

  if (!display) return null;

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Edit division"
      subtitle={display.name}
      dismissible={!confirmDelete}
      onCloseAttempt={() => !confirmDelete}
      overlay={
        <ConfirmDialog
          contained
          open={confirmDelete && open}
          title={`Delete “${display.name}”?`}
          description={divisionDeleteConfirmDescription()}
          confirmLabel="Delete division"
          tone="danger"
          busy={delPending}
          onConfirm={() => {
            if (delPending) return;
            const fd = new FormData();
            fd.set("id", display.id);
            startTransition(() => {
              void delAction(fd);
            });
          }}
          onCancel={() => {
            if (!delPending) setConfirmDelete(false);
          }}
        />
      }
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} disabled={confirmDelete} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-division-form"
            disabled={updPending || confirmDelete}
            className={btnPrimary}
          >
            {updPending ? "Saving…" : "Save changes"}
          </button>
        </ActionBar>
      }
      dangerZone={
        isAdmin ? (
          <div>
            <p className="text-sm font-semibold text-red-900">Danger zone</p>
            <p className="mt-1 text-xs text-zinc-500">{divisionDeleteDangerHint()}</p>
            <ErrorBanner message={delState && !delState.ok ? delState.error : undefined} />
            <div className="mt-3">
              <button type="button" onClick={() => setConfirmDelete(true)} className={btnDanger}>
                Delete division
              </button>
            </div>
          </div>
        ) : null
      }
    >
      <ErrorBanner message={updState && !updState.ok ? updState.error : undefined} />
      <form id="edit-division-form" action={updAction} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={display.id} />
        <div>
          <label htmlFor="edit-div-name" className={labelClass}>
            Name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input
            id="edit-div-name"
            name="name"
            required
            defaultValue={display.name}
            className={formClass}
          />
        </div>
        <div>
          <label htmlFor="edit-div-sort" className={labelClass}>
            Sort order
          </label>
          <input
            id="edit-div-sort"
            name="sortOrder"
            type="number"
            required
            defaultValue={display.sortOrder}
            className={formClass}
          />
        </div>
      </form>
    </EntityEditorSheet>
  );
}

function AddPoolSheet({
  open,
  onClose,
  divisions,
  defaultDivisionId,
}: {
  open: boolean;
  onClose: () => void;
  divisions: DivisionWithPools[];
  defaultDivisionId?: string;
}) {
  const [state, action, pending] = useActionState(createPool, undefined as ActionResult | undefined);

  useEffect(() => {
    if (!open) return;
    if (state?.ok) onClose();
  }, [state, open, onClose]);

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Add pool"
      description="Pools sit under a division and hold teams."
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form="add-pool-form" disabled={pending || divisions.length === 0} className={btnPrimary}>
            {pending ? "Saving…" : "Create pool"}
          </button>
        </ActionBar>
      }
    >
      <ErrorBanner message={state && !state.ok ? state.error : undefined} />
      {divisions.length === 0 ? (
        <p className="text-sm text-amber-800">Create a division before adding pools.</p>
      ) : (
        <form id="add-pool-form" action={action} className="flex flex-col gap-5">
          <div>
            <label htmlFor="add-pool-division" className={labelClass}>
              Division <span aria-hidden className="text-red-500">*</span>
            </label>
            <select
              id="add-pool-division"
              name="divisionId"
              required
              className={formClass}
              defaultValue={defaultDivisionId ?? ""}
            >
              <option value="">Select…</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="add-pool-name" className={labelClass}>
              Pool name <span aria-hidden className="text-red-500">*</span>
            </label>
            <input id="add-pool-name" name="name" required className={formClass} placeholder="e.g. Royal" />
          </div>
          <div>
            <label htmlFor="add-pool-sort" className={labelClass}>
              Sort order <span className="text-zinc-400">(optional)</span>
            </label>
            <input id="add-pool-sort" name="sortOrder" type="number" className={formClass} placeholder="auto" />
          </div>
          <div>
            <label htmlFor="add-pool-color" className={labelClass}>
              Name on public cards
            </label>
            <select id="add-pool-color" name="cardLabelColor" className={formClass} defaultValue="">
              <option value="">Default (grey)</option>
              {POOL_CARD_LABEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      )}
    </EntityEditorSheet>
  );
}

function EditPoolSheet({
  open,
  onClose,
  pool,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  pool: (Pool & { teams: Team[] }) | null;
  isAdmin: boolean;
}) {
  const [updState, updAction, updPending] = useActionState(updatePool, undefined as ActionResult | undefined);
  const [delState, delAction, delPending] = useActionState(deletePool, undefined as ActionResult | undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [display, setDisplay] = useState(pool);
  if (pool != null && pool !== display) setDisplay(pool);

  useEffect(() => {
    if (!open) return;
    if (updState?.ok) onClose();
  }, [updState, open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (delState?.ok) onClose();
  }, [delState, open, onClose]);

  if (!display) return null;

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Edit pool"
      subtitle={display.name}
      dismissible={!confirmDelete}
      onCloseAttempt={() => !confirmDelete}
      overlay={
        <ConfirmDialog
          contained
          open={confirmDelete && open}
          title={`Delete “${display.name}”?`}
          description={poolDeleteConfirmDescription()}
          confirmLabel="Delete pool"
          tone="danger"
          busy={delPending}
          onConfirm={() => {
            if (delPending) return;
            const fd = new FormData();
            fd.set("id", display.id);
            startTransition(() => {
              void delAction(fd);
            });
          }}
          onCancel={() => {
            if (!delPending) setConfirmDelete(false);
          }}
        />
      }
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} disabled={confirmDelete} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-pool-form"
            disabled={updPending || confirmDelete}
            className={btnPrimary}
          >
            {updPending ? "Saving…" : "Save changes"}
          </button>
        </ActionBar>
      }
      dangerZone={
        isAdmin ? (
          <div>
            <p className="text-sm font-semibold text-red-900">Danger zone</p>
            <p className="mt-1 text-xs text-zinc-500">{poolDeleteDangerHint(display.teams.length)}</p>
            <ErrorBanner message={delState && !delState.ok ? delState.error : undefined} />
            <div className="mt-3">
              <button type="button" onClick={() => setConfirmDelete(true)} className={btnDanger}>
                Delete pool
              </button>
            </div>
          </div>
        ) : null
      }
    >
      <ErrorBanner message={updState && !updState.ok ? updState.error : undefined} />
      <p className="mb-4 text-xs text-zinc-500">
        {display.teams.length} team{display.teams.length === 1 ? "" : "s"} · manage names on{" "}
        <Link href="/admin/teams" className="font-medium text-emerald-800 underline">
          Teams
        </Link>
        .
      </p>
      <form id="edit-pool-form" action={updAction} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={display.id} />
        <div>
          <label htmlFor="edit-pool-name" className={labelClass}>
            Name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input
            id="edit-pool-name"
            name="name"
            required
            defaultValue={display.name}
            className={formClass}
          />
        </div>
        <div>
          <label htmlFor="edit-pool-sort" className={labelClass}>
            Sort order
          </label>
          <input
            id="edit-pool-sort"
            name="sortOrder"
            type="number"
            required
            defaultValue={display.sortOrder}
            className={formClass}
          />
        </div>
        <div>
          <label htmlFor="edit-pool-color" className={labelClass}>
            Name on public cards
          </label>
          <select
            id="edit-pool-color"
            name="cardLabelColor"
            className={formClass}
            defaultValue={display.cardLabelColor ?? ""}
          >
            <option value="">Default (grey)</option>
            {POOL_CARD_LABEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </form>
    </EntityEditorSheet>
  );
}

// ---------------------------------------------------------------------------
// Division card
// ---------------------------------------------------------------------------

function DivisionSummaryCard({
  division,
  expanded,
  onToggle,
  onEditDivision,
  onEditPool,
  onAddPool,
}: {
  division: DivisionWithPools;
  expanded: boolean;
  onToggle: () => void;
  onEditDivision: () => void;
  onEditPool: (poolId: string) => void;
  onAddPool: () => void;
}) {
  const teamCount = countTeamsInPools(division.pools);
  const readiness = divisionReadiness({
    poolCount: division.pools.length,
    teamCount,
    bracket: firstBracket(division),
  });

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Division</p>
          <h2 className="text-lg font-semibold text-zinc-900">{division.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            <span>
              {division.pools.length} pool{division.pools.length === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>
              {teamCount} team{teamCount === 1 ? "" : "s"}
            </span>
            {readiness.formatLabel ? (
              <>
                <span aria-hidden>·</span>
                <span>{readiness.formatLabel}</span>
              </>
            ) : null}
            <StatusBadge tone={readiness.tone as StatusTone}>{readiness.label}</StatusBadge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEditDivision} className={btnSecondary + " px-3 text-xs"}>
            Edit
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={btnGhost}
          >
            {expanded ? "Hide pools" : "Show pools"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pools</h3>
            <button type="button" onClick={onAddPool} className={btnSecondary + " h-9 px-3 text-xs"}>
              Add pool
            </button>
          </div>
          {division.pools.length === 0 ? (
            <p className="text-sm text-zinc-500">No pools yet. Add one to start placing teams.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {division.pools.map((pool) => (
                <li
                  key={pool.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className={`font-medium ${poolCardLabelTextClass(pool.cardLabelColor) || "text-zinc-900"}`}>
                      {pool.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {pool.teams.length} team{pool.teams.length === 1 ? "" : "s"}
                      <span aria-hidden> · </span>
                      {cardLabelDisplay(pool.cardLabelColor)}
                      <span aria-hidden> · </span>
                      Sort {pool.sortOrder}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/admin/teams" className={btnGhost}>
                      Teams
                    </Link>
                    <button
                      type="button"
                      onClick={() => onEditPool(pool.id)}
                      className={btnSecondary + " px-3 text-xs"}
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function DivisionsHierarchy({ tournament, isAdmin }: Props) {
  const [sheet, dispatchSheet] = useReducer(
    (s: ReturnType<typeof createInitialEntitySheetState>, a: Parameters<typeof entitySheetReducer>[1]) =>
      entitySheetReducer(s, a),
    createInitialEntitySheetState(),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [poolParentDivisionId, setPoolParentDivisionId] = useState<string | undefined>();

  const closeSheet = useCallback(() => dispatchSheet({ type: "CLOSE" }), []);
  const openAddDivision = useCallback(() => dispatchSheet({ type: "OPEN", mode: "add-division" }), []);
  const openAddPool = useCallback((divisionId?: string) => {
    setPoolParentDivisionId(divisionId);
    dispatchSheet({ type: "OPEN", mode: "add-pool" });
  }, []);
  const openEditDivision = useCallback(
    (id: string) => dispatchSheet({ type: "OPEN", mode: "edit-division", entityId: id }),
    [],
  );
  const openEditPool = useCallback(
    (id: string) => dispatchSheet({ type: "OPEN", mode: "edit-pool", entityId: id }),
    [],
  );

  const editingDivision =
    sheet.mode === "edit-division" ? resolveEntityById(tournament.divisions, sheet.entityId) : null;

  const allPools = tournament.divisions.flatMap((d) => d.pools);
  const editingPool = sheet.mode === "edit-pool" ? resolveEntityById(allPools, sheet.entityId) : null;

  useEffect(() => {
    if (sheet.mode === "edit-division" && sheet.open && sheet.entityId && !editingDivision) {
      dispatchSheet({ type: "ENTITY_GONE" });
    }
  }, [sheet.mode, sheet.open, sheet.entityId, editingDivision]);

  useEffect(() => {
    if (sheet.mode === "edit-pool" && sheet.open && sheet.entityId && !editingPool) {
      dispatchSheet({ type: "ENTITY_GONE" });
    }
  }, [sheet.mode, sheet.open, sheet.entityId, editingPool]);

  const totalTeams = countTeamsInPools(allPools);
  const totalPools = allPools.length;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={tournament.name}
        title="Divisions"
        description="Hierarchy: divisions → pools → teams."
        meta={`${tournament.divisions.length} division${tournament.divisions.length === 1 ? "" : "s"} · ${totalPools} pool${totalPools === 1 ? "" : "s"} · ${totalTeams} team${totalTeams === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href="/admin/teams" className={btnSecondary}>
              Manage teams →
            </Link>
            <button
              type="button"
              onClick={() => openAddPool()}
              disabled={tournament.divisions.length === 0}
              className={btnSecondary}
            >
              Add pool
            </button>
            <button type="button" onClick={openAddDivision} className={btnPrimary}>
              Add division
            </button>
          </>
        }
      />

      {tournament.divisions.length === 0 ? (
        <section className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-emerald-950">Start with a division</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-emerald-900/80">
            Age brackets or flight groups go here first. Then add pools, then paste teams.
          </p>
          <button type="button" onClick={openAddDivision} className={`${btnPrimary} mt-5`}>
            Add division
          </button>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {tournament.divisions.map((division) => (
            <DivisionSummaryCard
              key={division.id}
              division={division}
              expanded={expanded.has(division.id)}
              onToggle={() => toggleExpanded(division.id)}
              onEditDivision={() => openEditDivision(division.id)}
              onEditPool={openEditPool}
              onAddPool={() => openAddPool(division.id)}
            />
          ))}
        </div>
      )}

      {sheet.mode === "add-division" ? (
        <AddDivisionSheet key={sheet.session} open={sheet.open} onClose={closeSheet} />
      ) : null}
      {sheet.mode === "edit-division" ? (
        <EditDivisionSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          division={editingDivision}
          isAdmin={isAdmin}
        />
      ) : null}
      {sheet.mode === "add-pool" ? (
        <AddPoolSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          divisions={tournament.divisions}
          defaultDivisionId={poolParentDivisionId}
        />
      ) : null}
      {sheet.mode === "edit-pool" ? (
        <EditPoolSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          pool={editingPool}
          isAdmin={isAdmin}
        />
      ) : null}
    </div>
  );
}
