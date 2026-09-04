"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import Link from "next/link";
import type { Division, Pool, Team } from "@prisma/client";
import {
  clearTeamLogo,
  createTeam,
  deleteTeam,
  importPoolTeams,
  updateTeam,
  uploadTeamLogo,
  type ActionResult,
} from "@/app/admin/_actions/structure";
import { teamLogoUrl } from "@/lib/team-logo";
import { PLACEHOLDER_TEAM_NAME_RE } from "@/lib/admin-setup-checklist";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { EntityEditorSheet } from "@/components/admin/ui/EntityEditorSheet";
import { ActionBar } from "@/components/admin/ui/ActionBar";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { ResponsiveEntityList, type EntityColumn } from "@/components/admin/ui/ResponsiveEntityList";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import {
  PoolAssignmentBoard,
  type PoolAssignmentDivision,
} from "@/components/admin/structure/PoolAssignmentBoard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamWithRelations = Team & {
  pool: Pool & { division: Division };
  logo: { mimeType: string; updatedAt: Date } | null;
};

export type PoolOption = {
  poolId: string;
  divisionId: string;
  label: string;
};

// ---------------------------------------------------------------------------
// Shared design tokens
// ---------------------------------------------------------------------------

const formClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "inline-flex h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50";

// ---------------------------------------------------------------------------
// Pure team-filter reducer — exported so tests can import it without React
// ---------------------------------------------------------------------------

export type TeamsFilterState = {
  search: string;
  divisionId: string;
  poolId: string;
  sortBy: "name" | "seed" | "pool";
};

export type TeamsFilterAction =
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_DIVISION"; value: string }
  | { type: "SET_POOL"; value: string }
  | { type: "SET_SORT"; value: TeamsFilterState["sortBy"] }
  | { type: "RESET" };

export const INITIAL_FILTER_STATE: TeamsFilterState = {
  search: "",
  divisionId: "",
  poolId: "",
  sortBy: "name",
};

/** Pure reducer — no side effects, safe to test without a DOM. */
export function teamsFilterReducer(state: TeamsFilterState, action: TeamsFilterAction): TeamsFilterState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, search: action.value };
    case "SET_DIVISION":
      // Changing division resets the pool filter (pool may not exist in new division).
      return { ...state, divisionId: action.value, poolId: "" };
    case "SET_POOL":
      return { ...state, poolId: action.value };
    case "SET_SORT":
      return { ...state, sortBy: action.value };
    case "RESET":
      return INITIAL_FILTER_STATE;
    default:
      return state;
  }
}

/** Apply filter + sort to a flat list of teams. Pure function, safe to test. */
export function applyTeamsFilter(
  teams: TeamWithRelations[],
  filter: TeamsFilterState,
): TeamWithRelations[] {
  const needle = filter.search.trim().toLowerCase();
  let out = teams;

  if (needle) out = out.filter((t) => t.name.toLowerCase().includes(needle));
  if (filter.divisionId) out = out.filter((t) => t.pool.division.id === filter.divisionId);
  if (filter.poolId) out = out.filter((t) => t.poolId === filter.poolId);

  return [...out].sort((a, b) => {
    switch (filter.sortBy) {
      case "seed": {
        const sa = a.seed ?? Infinity;
        const sb = b.seed ?? Infinity;
        return sa === sb ? a.name.localeCompare(b.name) : sa - sb;
      }
      case "pool":
        return (
          a.pool.division.name.localeCompare(b.pool.division.name) ||
          a.pool.name.localeCompare(b.pool.name) ||
          a.name.localeCompare(b.name)
        );
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

// ---------------------------------------------------------------------------
// Sheet session state — remount sheets per opening so useActionState is fresh
// ---------------------------------------------------------------------------

/**
 * Sheet UI state.
 *
 * `session` increments on every OPEN_* so React remounts the sheet component
 * (via `key={session}`), clearing useActionState success/error leftovers.
 * `open` goes false on CLOSE while `mode` stays, preserving the drawer exit
 * animation until the next OPEN remounts a new session.
 */
export type TeamsSheetState = {
  mode: "idle" | "add" | "edit" | "import";
  session: number;
  teamId: string | null;
  open: boolean;
};

export type TeamsSheetAction =
  | { type: "OPEN_ADD" }
  | { type: "OPEN_EDIT"; teamId: string }
  | { type: "OPEN_IMPORT" }
  | { type: "CLOSE" }
  | { type: "TEAM_GONE" };

export const INITIAL_SHEET_STATE: TeamsSheetState = {
  mode: "idle",
  session: 0,
  teamId: null,
  open: false,
};

/** Pure sheet-session reducer — safe to unit-test without a DOM. */
export function teamsSheetReducer(state: TeamsSheetState, action: TeamsSheetAction): TeamsSheetState {
  switch (action.type) {
    case "OPEN_ADD":
      return { mode: "add", session: state.session + 1, teamId: null, open: true };
    case "OPEN_EDIT":
      return { mode: "edit", session: state.session + 1, teamId: action.teamId, open: true };
    case "OPEN_IMPORT":
      return { mode: "import", session: state.session + 1, teamId: null, open: true };
    case "CLOSE":
      return { ...state, open: false };
    case "TEAM_GONE":
      if (state.mode === "edit") {
        return { ...state, open: false, mode: "idle", teamId: null };
      }
      return state;
    default:
      return state;
  }
}

/** Resolve the live team object for an edit session from the latest props. */
export function resolveEditingTeam(
  teams: readonly TeamWithRelations[],
  teamId: string | null,
): TeamWithRelations | null {
  if (!teamId) return null;
  return teams.find((t) => t.id === teamId) ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function teamInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return ((words[0] ?? "")[0] ?? "").toUpperCase() + ((words[1] ?? "")[0] ?? "").toUpperCase();
}

function ErrorBanner({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Add team sheet
// ---------------------------------------------------------------------------

function AddTeamSheet({
  open,
  onClose,
  poolOptions,
}: {
  open: boolean;
  onClose: () => void;
  poolOptions: PoolOption[];
}) {
  const [state, action, pending] = useActionState(createTeam, undefined as ActionResult | undefined);

  // Fresh mount per session ⇒ state starts undefined; only this session's
  // successful submit can close the sheet.
  useEffect(() => {
    if (!open) return;
    if (state?.ok) onClose();
  }, [state, open, onClose]);

  const error = state && !state.ok ? state.error : undefined;

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Add team"
      description="Every team must belong to a pool."
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form="add-team-form" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Create team"}
          </button>
        </ActionBar>
      }
    >
      <ErrorBanner message={error} />
      <form id="add-team-form" action={action} className="flex flex-col gap-5">
        <div>
          <label htmlFor="add-pool" className={labelClass}>
            Division / pool <span aria-hidden className="text-red-500">*</span>
          </label>
          <select id="add-pool" name="poolId" required className={formClass}>
            <option value="">Select…</option>
            {poolOptions.map((o) => (
              <option key={o.poolId} value={o.poolId}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="add-name" className={labelClass}>
            Team name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input id="add-name" name="name" required className={formClass} placeholder="Lightning" />
        </div>
        <div>
          <label htmlFor="add-seed" className={labelClass}>
            Seed <span className="text-zinc-400">(optional)</span>
          </label>
          <input id="add-seed" name="seed" type="number" min={0} className={formClass} placeholder="—" />
        </div>
      </form>
    </EntityEditorSheet>
  );
}

// ---------------------------------------------------------------------------
// Edit team sheet
// ---------------------------------------------------------------------------

function EditTeamSheet({
  open,
  onClose,
  team,
  poolOptions,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  /** Live team derived from latest props; may briefly be null while closing. */
  team: TeamWithRelations | null;
  poolOptions: PoolOption[];
  isAdmin: boolean;
}) {
  const [updState, updAction, updPending] = useActionState(updateTeam, undefined as ActionResult | undefined);
  const [delState, delAction, delPending] = useActionState(deleteTeam, undefined as ActionResult | undefined);
  const [logoUpState, logoUpAction, logoUpPending] = useActionState(
    uploadTeamLogo,
    undefined as ActionResult | undefined,
  );
  const [logoClearState, logoClearAction, logoClearPending] = useActionState(
    clearTeamLogo,
    undefined as ActionResult | undefined,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep the last known team so the drawer can finish its exit animation after
  // a successful delete removes the row from props. Official React pattern:
  // adjust state during render when props provide a newer non-null team.
  const [displayTeam, setDisplayTeam] = useState(team);
  if (team != null && team !== displayTeam) {
    setDisplayTeam(team);
  }

  useEffect(() => {
    if (!open) return;
    if (updState?.ok) onClose();
  }, [updState, open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (delState?.ok) onClose();
  }, [delState, open, onClose]);

  if (!displayTeam) return null;

  const updError = updState && !updState.ok ? updState.error : undefined;
  const delError = delState && !delState.ok ? delState.error : undefined;
  const logoUpError = logoUpState && !logoUpState.ok ? logoUpState.error : undefined;
  const logoClearError = logoClearState && !logoClearState.ok ? logoClearState.error : undefined;

  return (
      <EntityEditorSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Edit team"
        subtitle={displayTeam.name}
        dismissible={!confirmDelete}
        onCloseAttempt={() => !confirmDelete}
        overlay={
          <ConfirmDialog
            contained
            open={confirmDelete && open}
            title={`Delete "${displayTeam.name}"?`}
            description="This is permanent. Teams with scheduled games cannot be deleted — remove or reassign their games first."
            confirmLabel="Delete team"
            tone="danger"
            busy={delPending}
            onConfirm={() => {
              if (delPending) return;
              const fd = new FormData();
              fd.set("id", displayTeam.id);
              startTransition(() => {
                void delAction(fd);
              });
            }}
            onCancel={() => {
              if (delPending) return;
              setConfirmDelete(false);
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
              form="edit-team-form"
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
              <p className="mt-1 text-xs text-zinc-500">
                Deleting a team that has scheduled games is blocked. Remove or reassign its games
                first.
              </p>
              <ErrorBanner message={delError} />
              <div className="mt-3">
                <button type="button" onClick={() => setConfirmDelete(true)} className={btnDanger}>
                  Delete team
                </button>
              </div>
            </div>
          ) : null
        }
      >
        <ErrorBanner message={updError} />
        <form id="edit-team-form" action={updAction} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={displayTeam.id} />
          <div>
            <label htmlFor="edit-pool" className={labelClass}>
              Division / pool <span aria-hidden className="text-red-500">*</span>
            </label>
            <select
              id="edit-pool"
              name="poolId"
              required
              defaultValue={displayTeam.poolId}
              className={formClass}
            >
              {poolOptions.map((o) => (
                <option key={o.poolId} value={o.poolId}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-name" className={labelClass}>
              Team name <span aria-hidden className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              name="name"
              required
              defaultValue={displayTeam.name}
              className={formClass}
            />
          </div>
          <div>
            <label htmlFor="edit-seed" className={labelClass}>
              Seed <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="edit-seed"
              name="seed"
              type="number"
              min={0}
              defaultValue={displayTeam.seed ?? ""}
              className={formClass}
            />
          </div>
        </form>

        {/* Logo section — displayTeam tracks the latest props after revalidation */}
        <div className="mt-6 border-t border-zinc-100 pt-5">
          <p className={labelClass}>Team logo</p>
          <p className="mt-1 text-xs text-zinc-500">
            PNG, JPEG, or WebP · max 200 KB. Shown on the public schedule, results, and standings.
          </p>

          {displayTeam.logo ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={teamLogoUrl(displayTeam.id, displayTeam.logo.updatedAt)}
                alt=""
                className="h-12 w-12 rounded object-contain ring-1 ring-zinc-200"
              />
              <form action={logoClearAction}>
                <input type="hidden" name="teamId" value={displayTeam.id} />
                <button type="submit" disabled={logoClearPending} className={btnDanger}>
                  {logoClearPending ? "Removing…" : "Remove logo"}
                </button>
              </form>
            </div>
          ) : null}

          <ErrorBanner message={logoUpError} />
          <ErrorBanner message={logoClearError} />

          <form
            action={logoUpAction}
            encType="multipart/form-data"
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="teamId" value={displayTeam.id} />
            <div className="flex-1">
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp"
                className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800"
              />
            </div>
            <button type="submit" disabled={logoUpPending} className={btnSecondary}>
              {logoUpPending ? "Uploading…" : displayTeam.logo ? "Replace" : "Upload"}
            </button>
          </form>
        </div>
      </EntityEditorSheet>
  );
}

// ---------------------------------------------------------------------------
// Import (paste names) sheet
// ---------------------------------------------------------------------------

function ImportNamesSheet({
  open,
  onClose,
  poolOptions,
  existingTeams,
}: {
  open: boolean;
  onClose: () => void;
  poolOptions: PoolOption[];
  existingTeams: TeamWithRelations[];
}) {
  const [state, action, pending] = useActionState(importPoolTeams, undefined as ActionResult | undefined);
  const [selectedPoolId, setSelectedPoolId] = useState(poolOptions[0]?.poolId ?? "");
  const [namesText, setNamesText] = useState("");

  const previewLines = useMemo(
    () =>
      namesText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [namesText],
  );

  const existingInPool = useMemo(
    () => existingTeams.filter((t) => t.poolId === selectedPoolId),
    [existingTeams, selectedPoolId],
  );

  const renameCount = Math.min(existingInPool.length, previewLines.length);
  const createCount = Math.max(0, previewLines.length - existingInPool.length);

  useEffect(() => {
    if (!open) return;
    if (state?.ok) onClose();
  }, [state, open, onClose]);

  const error = state && !state.ok ? state.error : undefined;

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Paste team names"
      description="Paste one name per line. Existing teams in the selected pool are renamed in order (by seed, then creation time). Extra names create new teams."
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            form="import-names-form"
            disabled={pending || previewLines.length === 0}
            className={btnPrimary}
          >
            {pending ? "Applying…" : "Apply names"}
          </button>
        </ActionBar>
      }
    >
      <ErrorBanner message={error} />
      <form id="import-names-form" action={action} className="flex flex-col gap-5">
        <div>
          <label htmlFor="import-pool" className={labelClass}>
            Division / pool <span aria-hidden className="text-red-500">*</span>
          </label>
          <select
            id="import-pool"
            name="poolId"
            required
            className={formClass}
            value={selectedPoolId}
            onChange={(e) => setSelectedPoolId(e.target.value)}
          >
            {poolOptions.map((o) => (
              <option key={o.poolId} value={o.poolId}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="import-names" className={labelClass}>
            Team names (one per line)
          </label>
          <textarea
            id="import-names"
            name="namesText"
            required
            rows={8}
            className={formClass}
            placeholder={"Lightning\nThunder\nStorm"}
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Tip: copy directly from a spreadsheet column or email list.
          </p>
        </div>

        {previewLines.length > 0 ? (
          <div className="rounded-md bg-zinc-50 px-4 py-3 text-sm text-zinc-700 ring-1 ring-zinc-200">
            <p className="font-medium">
              {previewLines.length} name{previewLines.length !== 1 ? "s" : ""} detected:
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
              {renameCount > 0 ? (
                <li>
                  → {renameCount} existing team{renameCount !== 1 ? "s" : ""} will be renamed
                </li>
              ) : null}
              {createCount > 0 ? (
                <li>
                  → {createCount} new team{createCount !== 1 ? "s" : ""} will be created
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </form>
    </EntityEditorSheet>
  );
}

// ---------------------------------------------------------------------------
// Main TeamsAdmin component
// ---------------------------------------------------------------------------

type Props = {
  teams: TeamWithRelations[];
  poolOptions: PoolOption[];
  assignmentDivisions: PoolAssignmentDivision[];
  tournamentName: string;
  isAdmin: boolean;
  canAssignPools: boolean;
};

export function TeamsAdmin({
  teams,
  poolOptions,
  assignmentDivisions,
  tournamentName,
  isAdmin,
  canAssignPools,
}: Props) {
  const [sheet, dispatchSheet] = useReducer(teamsSheetReducer, INITIAL_SHEET_STATE);
  const [filter, dispatchFilter] = useReducer(teamsFilterReducer, INITIAL_FILTER_STATE);

  const closeSheet = useCallback(() => dispatchSheet({ type: "CLOSE" }), []);
  const openAdd = useCallback(() => dispatchSheet({ type: "OPEN_ADD" }), []);
  const openImport = useCallback(() => dispatchSheet({ type: "OPEN_IMPORT" }), []);
  const openEdit = useCallback(
    (team: TeamWithRelations) => dispatchSheet({ type: "OPEN_EDIT", teamId: team.id }),
    [],
  );

  const editingTeam = useMemo(
    () => (sheet.mode === "edit" ? resolveEditingTeam(teams, sheet.teamId) : null),
    [sheet.mode, sheet.teamId, teams],
  );

  // If the edited team vanished after revalidation (e.g. deleted elsewhere), close safely.
  useEffect(() => {
    if (sheet.mode === "edit" && sheet.open && sheet.teamId && !editingTeam) {
      dispatchSheet({ type: "TEAM_GONE" });
    }
  }, [sheet.mode, sheet.open, sheet.teamId, editingTeam]);

  const divisions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of teams) seen.set(t.pool.division.id, t.pool.division.name);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [teams]);

  const poolsForDivision = useMemo(() => {
    if (!filter.divisionId) return [];
    const seen = new Map<string, string>();
    for (const t of teams) {
      if (t.pool.division.id === filter.divisionId) seen.set(t.poolId, t.pool.name);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [teams, filter.divisionId]);

  const filtered = useMemo(() => applyTeamsFilter(teams, filter), [teams, filter]);

  const placeholderCount = teams.filter((t) => PLACEHOLDER_TEAM_NAME_RE.test(t.name)).length;

  const columns: EntityColumn<TeamWithRelations>[] = [
    {
      key: "team",
      header: "Team",
      cell: (t) => (
        <div className="flex items-center gap-3">
          {t.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogoUrl(t.id, t.logo.updatedAt)}
              alt=""
              className="h-8 w-8 shrink-0 rounded object-contain ring-1 ring-zinc-200/80"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-100 text-[11px] font-semibold text-zinc-500"
            >
              {teamInitials(t.name)}
            </span>
          )}
          <span className="font-medium text-zinc-900">{t.name}</span>
          {PLACEHOLDER_TEAM_NAME_RE.test(t.name) ? (
            <StatusBadge tone="warning">Placeholder</StatusBadge>
          ) : null}
        </div>
      ),
    },
    {
      key: "division",
      header: "Division",
      cell: (t) => <span className="text-zinc-600">{t.pool.division.name}</span>,
    },
    {
      key: "pool",
      header: "Pool",
      cell: (t) => <span className="text-zinc-600">{t.pool.name}</span>,
    },
    {
      key: "seed",
      header: "Seed",
      align: "right",
      cell: (t) => <span className="tabular-nums text-zinc-600">{t.seed ?? "—"}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (t) => (
        <button
          type="button"
          onClick={() => openEdit(t)}
          aria-label={`Edit ${t.name}`}
          className={btnSecondary + " px-3 text-xs"}
        >
          Edit
        </button>
      ),
    },
  ];

  // Keep the sheet mounted while open=false so the exit animation can play;
  // remount on the next OPEN_* via key={session}.
  const showAdd = sheet.mode === "add";
  const showEdit = sheet.mode === "edit";
  const showImport = sheet.mode === "import";

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={tournamentName}
        title="Teams"
        meta={`${teams.length} team${teams.length !== 1 ? "s" : ""}${
          placeholderCount > 0
            ? ` · ${placeholderCount} placeholder${placeholderCount !== 1 ? "s" : ""}`
            : ""
        }`}
        actions={
          <>
            {poolOptions.length > 0 ? (
              <>
                <button type="button" onClick={openImport} className={btnSecondary}>
                  Paste / import names
                </button>
                <button type="button" onClick={openAdd} className={btnPrimary}>
                  Add team
                </button>
              </>
            ) : null}
          </>
        }
      />

      {poolOptions.length === 0 ? (
        <section className="rounded-xl border border-dashed border-amber-300 bg-amber-50/80 px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-amber-950">No pools yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-900/80">
            Create a division and at least one pool first, then come back to add teams.
          </p>
          <Link href="/admin/divisions" className={`${btnPrimary} mt-5`}>
            Go to Divisions &amp; pools →
          </Link>
        </section>
      ) : null}

      {assignmentDivisions.some((d) => d.pools.length > 0) ? (
        <PoolAssignmentBoard divisions={assignmentDivisions} canAssign={canAssignPools} />
      ) : null}

      {placeholderCount > 0 && poolOptions.length > 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-4">
          <p className="text-sm font-semibold text-emerald-950">
            {placeholderCount} placeholder name{placeholderCount !== 1 ? "s" : ""} need real names
          </p>
          <p className="mt-1 text-xs text-emerald-900/80">
            Use{" "}
            <button type="button" onClick={openImport} className="font-medium underline">
              Paste / import names
            </button>{" "}
            to rename them in bulk, or edit each team individually.
          </p>
        </div>
      ) : null}

      {teams.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label htmlFor="team-search" className={labelClass}>
              Search
            </label>
            <input
              id="team-search"
              type="search"
              placeholder="Team name…"
              value={filter.search}
              onChange={(e) => dispatchFilter({ type: "SET_SEARCH", value: e.target.value })}
              className={formClass}
            />
          </div>
          {divisions.length > 1 ? (
            <div className="min-w-[140px]">
              <label htmlFor="team-division-filter" className={labelClass}>
                Division
              </label>
              <select
                id="team-division-filter"
                value={filter.divisionId}
                onChange={(e) => dispatchFilter({ type: "SET_DIVISION", value: e.target.value })}
                className={formClass}
              >
                <option value="">All divisions</option>
                {divisions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {poolsForDivision.length > 1 ? (
            <div className="min-w-[120px]">
              <label htmlFor="team-pool-filter" className={labelClass}>
                Pool
              </label>
              <select
                id="team-pool-filter"
                value={filter.poolId}
                onChange={(e) => dispatchFilter({ type: "SET_POOL", value: e.target.value })}
                className={formClass}
              >
                <option value="">All pools</option>
                {poolsForDivision.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="min-w-[120px]">
            <label htmlFor="team-sort" className={labelClass}>
              Sort by
            </label>
            <select
              id="team-sort"
              value={filter.sortBy}
              onChange={(e) =>
                dispatchFilter({
                  type: "SET_SORT",
                  value: e.target.value as TeamsFilterState["sortBy"],
                })
              }
              className={formClass}
            >
              <option value="name">Name</option>
              <option value="seed">Seed</option>
              <option value="pool">Pool</option>
            </select>
          </div>
          {filter.search || filter.divisionId || filter.poolId || filter.sortBy !== "name" ? (
            <button
              type="button"
              onClick={() => dispatchFilter({ type: "RESET" })}
              className={btnSecondary + " self-end"}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {poolOptions.length > 0 ? (
        <ResponsiveEntityList
          rows={filtered}
          columns={columns}
          getRowKey={(t) => t.id}
          caption="Teams list"
          renderCard={(t) => (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={teamLogoUrl(t.id, t.logo.updatedAt)}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-contain ring-1 ring-zinc-200/80"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-100 text-sm font-semibold text-zinc-500"
                  >
                    {teamInitials(t.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-900">{t.name}</p>
                  <p className="text-xs text-zinc-500">
                    {t.pool.division.name} · {t.pool.name}
                    {t.seed != null ? ` · Seed ${t.seed}` : ""}
                  </p>
                  {PLACEHOLDER_TEAM_NAME_RE.test(t.name) ? (
                    <StatusBadge tone="warning" className="mt-1">
                      Placeholder
                    </StatusBadge>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(t)}
                aria-label={`Edit ${t.name}`}
                className={btnSecondary + " shrink-0 px-3 text-xs"}
              >
                Edit
              </button>
            </div>
          )}
          emptyState={
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
              {filter.search || filter.divisionId || filter.poolId ? (
                <>
                  <p className="text-sm font-medium text-zinc-700">No teams match the current filters.</p>
                  <button
                    type="button"
                    onClick={() => dispatchFilter({ type: "RESET" })}
                    className={`${btnSecondary} mt-3`}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-700">No teams yet.</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Use <strong>Add team</strong> or <strong>Paste / import names</strong> above.
                  </p>
                </>
              )}
            </div>
          }
        />
      ) : null}

      {showAdd ? (
        <AddTeamSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          poolOptions={poolOptions}
        />
      ) : null}
      {showEdit ? (
        <EditTeamSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          team={editingTeam}
          poolOptions={poolOptions}
          isAdmin={isAdmin}
        />
      ) : null}
      {showImport ? (
        <ImportNamesSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          poolOptions={poolOptions}
          existingTeams={teams}
        />
      ) : null}
    </div>
  );
}
