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
import type { Field, Location } from "@prisma/client";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import {
  createVenue,
  deleteVenue,
  moveVenue,
  setLocationAsHeadquarters,
  updateVenue,
} from "@/app/admin/_actions/venues";
import { createField, deleteField, moveField, updateField } from "@/app/admin/_actions/fields";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { ActionBar } from "@/components/admin/ui/ActionBar";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { EntityEditorSheet } from "@/components/admin/ui/EntityEditorSheet";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { ReorderMenu } from "@/components/admin/ui/ReorderMenu";
import { useEditorFormUx } from "@/components/admin/ui/useEditorFormUx";
import {
  createInitialEntitySheetState,
  entitySheetReducer,
  resolveEntityById,
} from "@/components/admin/ui/entity-sheet-session";
import { hasMapLinkAvailability, shortAddress } from "@/components/admin/venues/venue-summary";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";

export type FieldWithGameCount = Field & { _count: { games: number } };
export type LocationWithFields = Location & { fields: FieldWithGameCount[] };

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
  "inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50";

function ErrorBanner({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
      {message}
    </p>
  );
}

function actionError(state: ContentActionResult | undefined): string | undefined {
  return state && !state.ok ? state.error : undefined;
}

// ---------------------------------------------------------------------------
// Location sheets
// ---------------------------------------------------------------------------

function AddLocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(createVenue, undefined as ContentActionResult | undefined);

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
      title="Add location"
      description="Park or site. Diamonds are added as fields under the location."
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form="add-location-form" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Add location"}
          </button>
        </ActionBar>
      }
    >
      <ErrorBanner message={actionError(state)} />
      <form id="add-location-form" action={action} className="flex flex-col gap-5">
        <div>
          <label htmlFor="add-loc-name" className={labelClass}>
            Name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input id="add-loc-name" name="name" required className={formClass} />
        </div>
        <div>
          <label htmlFor="add-loc-address" className={labelClass}>
            Address
          </label>
          <textarea id="add-loc-address" name="address" rows={2} className={formClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="add-loc-lat" className={labelClass}>
              Latitude
            </label>
            <input id="add-loc-lat" name="latitude" className={formClass} placeholder="30.5086" />
          </div>
          <div>
            <label htmlFor="add-loc-lon" className={labelClass}>
              Longitude
            </label>
            <input id="add-loc-lon" name="longitude" className={formClass} placeholder="-97.6789" />
          </div>
        </div>
        <div>
          <label htmlFor="add-loc-map" className={labelClass}>
            Custom map link
          </label>
          <input id="add-loc-map" name="mapLink" type="url" className={formClass} />
        </div>
        <div>
          <label htmlFor="add-loc-sort" className={labelClass}>
            Sort order <span className="text-zinc-400">(optional)</span>
          </label>
          <input id="add-loc-sort" name="sortOrder" type="number" className={formClass} />
        </div>
        <p className="text-xs text-zinc-500">
          The first location becomes headquarters automatically. Set HQ from Edit after creating more sites.
        </p>
      </form>
    </EntityEditorSheet>
  );
}

function EditLocationSheet({
  open,
  onClose,
  location,
}: {
  open: boolean;
  onClose: () => void;
  location: LocationWithFields | null;
}) {
  const [updState, updAction, updPending] = useActionState(
    updateVenue,
    undefined as ContentActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteVenue,
    undefined as ContentActionResult | undefined,
  );
  const [hqState, hqAction, hqPending] = useActionState(
    setLocationAsHeadquarters,
    undefined as ContentActionResult | undefined,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [display, setDisplay] = useState(location);
  if (location != null && location !== display) setDisplay(location);

  const ux = useEditorFormUx({
    open,
    onClose,
    savedOk: Boolean(updState?.ok || delState?.ok),
    nestedBusy: confirmDelete,
  });

  if (!display) return null;

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) ux.onCloseAttempt();
      }}
      title="Edit location"
      subtitle={display.name}
      status={
        ux.justSaved ? (
          <StatusBadge tone="success">Saved</StatusBadge>
        ) : ux.dirty ? (
          <StatusBadge tone="warning">{ux.unsavedLabel}</StatusBadge>
        ) : null
      }
      dismissible={ux.dismissible}
      onCloseAttempt={ux.onCloseAttempt}
      overlay={
        <>
          <ConfirmDialog
            contained
            open={ux.discardOpen}
            title={ux.discardTitle}
            description={ux.discardDescription}
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            onConfirm={ux.confirmDiscard}
            onCancel={ux.cancelDiscard}
          />
          <ConfirmDialog
            contained
            open={confirmDelete && open}
            title={`Delete “${display.name}”?`}
            description="Locations with fields cannot be deleted. Reassign or remove fields first."
            confirmLabel="Delete location"
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
        </>
      }
      footer={
        <ActionBar align="end">
          {ux.justSaved ? (
            <p className="mr-auto text-sm font-medium text-emerald-800">Saved.</p>
          ) : null}
          <button
            type="button"
            onClick={() => ux.onCloseAttempt()}
            disabled={confirmDelete || ux.discardOpen}
            className={btnSecondary}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-location-form"
            disabled={updPending || confirmDelete || ux.justSaved}
            className={btnPrimary}
          >
            {updPending ? "Saving…" : "Save changes"}
          </button>
        </ActionBar>
      }
      dangerZone={
        <div>
          <p className="text-sm font-semibold text-red-900">Danger zone</p>
          <p className="mt-1 text-xs text-zinc-500">
            {display.fields.length > 0
              ? `This location has ${display.fields.length} field${display.fields.length === 1 ? "" : "s"}. Remove or reassign them before deleting.`
              : "Delete only if no fields remain."}
          </p>
          <ErrorBanner message={actionError(delState)} />
          <div className="mt-3">
            <button type="button" onClick={() => setConfirmDelete(true)} className={btnDanger}>
              Delete location
            </button>
          </div>
        </div>
      }
    >
      <ErrorBanner message={actionError(updState) ?? actionError(hqState)} />
      <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-3">
        <p className={labelClass}>Headquarters</p>
        {display.isHeadquarters ? (
          <p className="mt-1 text-sm text-emerald-900">This location is the tournament headquarters.</p>
        ) : (
          <form action={hqAction} className="mt-2">
            <input type="hidden" name="id" value={display.id} />
            <button type="submit" disabled={hqPending} className={btnSecondary + " h-9 text-xs"}>
              {hqPending ? "…" : "Set as headquarters"}
            </button>
          </form>
        )}
      </div>
      <form id="edit-location-form" action={updAction} className="flex flex-col gap-5" {...ux.formDirtyProps}>
        <input type="hidden" name="id" value={display.id} />
        <div>
          <label htmlFor="edit-loc-name" className={labelClass}>
            Name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input id="edit-loc-name" name="name" required defaultValue={display.name} className={formClass} />
        </div>
        <div>
          <label htmlFor="edit-loc-address" className={labelClass}>
            Address
          </label>
          <textarea
            id="edit-loc-address"
            name="address"
            rows={2}
            defaultValue={display.address ?? ""}
            className={formClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-loc-lat" className={labelClass}>
              Latitude
            </label>
            <input
              id="edit-loc-lat"
              name="latitude"
              defaultValue={display.latitude != null ? String(display.latitude) : ""}
              className={formClass}
            />
          </div>
          <div>
            <label htmlFor="edit-loc-lon" className={labelClass}>
              Longitude
            </label>
            <input
              id="edit-loc-lon"
              name="longitude"
              defaultValue={display.longitude != null ? String(display.longitude) : ""}
              className={formClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="edit-loc-map" className={labelClass}>
            Custom map link
          </label>
          <input
            id="edit-loc-map"
            name="mapLink"
            type="url"
            defaultValue={display.mapLink ?? ""}
            className={formClass}
          />
        </div>
        <div>
          <label htmlFor="edit-loc-sort" className={labelClass}>
            Sort order
          </label>
          <input
            id="edit-loc-sort"
            name="sortOrder"
            type="number"
            defaultValue={display.sortOrder}
            className={formClass}
          />
        </div>
      </form>
    </EntityEditorSheet>
  );
}

// ---------------------------------------------------------------------------
// Field sheets (shared by VenuesAdmin expand + FieldsAdmin)
// ---------------------------------------------------------------------------

export function AddFieldSheet({
  open,
  onClose,
  locations,
  defaultLocationId,
}: {
  open: boolean;
  onClose: () => void;
  locations: { id: string; name: string; isHeadquarters: boolean }[];
  defaultLocationId?: string;
}) {
  const [state, action, pending] = useActionState(createField, undefined as ContentActionResult | undefined);

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
      title="Add field"
      description="Diamonds belong to a location."
      footer={
        <ActionBar align="end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            form="add-field-form"
            disabled={pending || locations.length === 0}
            className={btnPrimary}
          >
            {pending ? "Saving…" : "Add field"}
          </button>
        </ActionBar>
      }
    >
      <ErrorBanner message={actionError(state)} />
      <form id="add-field-form" action={action} className="flex flex-col gap-5">
        <div>
          <label htmlFor="add-field-loc" className={labelClass}>
            Location <span aria-hidden className="text-red-500">*</span>
          </label>
          <select
            id="add-field-loc"
            name="locationId"
            required
            className={formClass}
            defaultValue={defaultLocationId ?? locations[0]?.id ?? ""}
          >
            {locations.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.isHeadquarters ? " (HQ)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="add-field-name" className={labelClass}>
            Field name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input id="add-field-name" name="name" required className={formClass} placeholder="Diamond 1" />
        </div>
        <div>
          <label htmlFor="add-field-sort" className={labelClass}>
            Sort order <span className="text-zinc-400">(optional)</span>
          </label>
          <input id="add-field-sort" name="sortOrder" type="number" className={formClass} />
        </div>
      </form>
    </EntityEditorSheet>
  );
}

export function EditFieldSheet({
  open,
  onClose,
  field,
  locations,
}: {
  open: boolean;
  onClose: () => void;
  field: FieldWithGameCount | null;
  locations: { id: string; name: string }[];
}) {
  const [updState, updAction, updPending] = useActionState(
    updateField,
    undefined as ContentActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteField,
    undefined as ContentActionResult | undefined,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [display, setDisplay] = useState(field);
  if (field != null && field !== display) setDisplay(field);

  const ux = useEditorFormUx({
    open,
    onClose,
    savedOk: Boolean(updState?.ok || delState?.ok),
    nestedBusy: confirmDelete,
  });

  if (!display) return null;

  const gameCount = display._count?.games ?? 0;

  return (
    <EntityEditorSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) ux.onCloseAttempt();
      }}
      title="Edit field"
      subtitle={display.name}
      status={
        ux.justSaved ? (
          <StatusBadge tone="success">Saved</StatusBadge>
        ) : ux.dirty ? (
          <StatusBadge tone="warning">{ux.unsavedLabel}</StatusBadge>
        ) : null
      }
      dismissible={ux.dismissible}
      onCloseAttempt={ux.onCloseAttempt}
      overlay={
        <>
          <ConfirmDialog
            contained
            open={ux.discardOpen}
            title={ux.discardTitle}
            description={ux.discardDescription}
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            onConfirm={ux.confirmDiscard}
            onCancel={ux.cancelDiscard}
          />
          <ConfirmDialog
            contained
            open={confirmDelete && open}
            title={`Delete “${display.name}”?`}
            description="You can’t delete a field that still has scheduled games."
            confirmLabel="Delete field"
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
        </>
      }
      footer={
        <ActionBar align="end">
          {ux.justSaved ? (
            <p className="mr-auto text-sm font-medium text-emerald-800">Saved.</p>
          ) : null}
          <button
            type="button"
            onClick={() => ux.onCloseAttempt()}
            disabled={confirmDelete || ux.discardOpen}
            className={btnSecondary}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-field-form"
            disabled={updPending || confirmDelete || ux.justSaved}
            className={btnPrimary}
          >
            {updPending ? "Saving…" : "Save changes"}
          </button>
        </ActionBar>
      }
      dangerZone={
        <div>
          <p className="text-sm font-semibold text-red-900">Danger zone</p>
          <p className="mt-1 text-xs text-zinc-500">
            {gameCount > 0
              ? `Used in ${gameCount} game${gameCount === 1 ? "" : "s"}. Reassign those games first.`
              : "Safe to delete if no games reference this field."}
          </p>
          <ErrorBanner message={actionError(delState)} />
          <div className="mt-3">
            <button type="button" onClick={() => setConfirmDelete(true)} className={btnDanger}>
              Delete field
            </button>
          </div>
        </div>
      }
    >
      <ErrorBanner message={actionError(updState)} />
      <form id="edit-field-form" action={updAction} className="flex flex-col gap-5" {...ux.formDirtyProps}>
        <input type="hidden" name="id" value={display.id} />
        <div>
          <label htmlFor="edit-field-name" className={labelClass}>
            Field name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input
            id="edit-field-name"
            name="name"
            required
            defaultValue={display.name}
            className={formClass}
          />
        </div>
        <div>
          <label htmlFor="edit-field-loc" className={labelClass}>
            Location
          </label>
          <select
            id="edit-field-loc"
            name="locationId"
            required
            defaultValue={display.locationId}
            className={formClass}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="edit-field-sort" className={labelClass}>
            Sort order
          </label>
          <input
            id="edit-field-sort"
            name="sortOrder"
            type="number"
            defaultValue={display.sortOrder}
            className={formClass}
          />
        </div>
      </form>
    </EntityEditorSheet>
  );
}

function FieldSummaryRow({
  field,
  locationName,
  index,
  total,
  onEdit,
}: {
  field: FieldWithGameCount;
  locationName: string;
  index: number;
  total: number;
  onEdit: () => void;
}) {
  const [upState, upAction, upPending] = useActionState(moveField, undefined as ContentActionResult | undefined);
  const [downState, downAction, downPending] = useActionState(
    moveField,
    undefined as ContentActionResult | undefined,
  );
  const gameCount = field._count?.games ?? 0;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3">
      <div className="min-w-0">
        <p className="font-medium text-zinc-900">{field.name}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {locationName}
          <span aria-hidden> · </span>
          {gameCount} game{gameCount === 1 ? "" : "s"}
          <span aria-hidden> · </span>
          Sort {field.sortOrder}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ReorderMenu
          label={`Reorder ${field.name}`}
          error={actionError(upState) ?? actionError(downState)}
        >
          <form action={upAction}>
            <input type="hidden" name="id" value={field.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={upPending || index === 0}
              className="flex h-10 w-full items-center rounded px-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
            >
              Move up
            </button>
          </form>
          <form action={downAction}>
            <input type="hidden" name="id" value={field.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={downPending || index >= total - 1}
              className="flex h-10 w-full items-center rounded px-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
            >
              Move down
            </button>
          </form>
        </ReorderMenu>
        <button type="button" onClick={onEdit} className={btnSecondary + " h-10 px-3 text-xs"}>
          Edit
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main VenuesAdmin
// ---------------------------------------------------------------------------

export function VenuesAdmin({
  locations,
  tournamentName,
  publicSitePath,
  canManage,
}: {
  locations: LocationWithFields[];
  tournamentName: string;
  publicSitePath: string;
  canManage: boolean;
}) {
  const [sheet, dispatchSheet] = useReducer(
    (s: ReturnType<typeof createInitialEntitySheetState>, a: Parameters<typeof entitySheetReducer>[1]) =>
      entitySheetReducer(s, a),
    createInitialEntitySheetState(),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fieldDefaultLoc, setFieldDefaultLoc] = useState<string | undefined>();

  const closeSheet = useCallback(() => dispatchSheet({ type: "CLOSE" }), []);
  const openAddLoc = useCallback(() => dispatchSheet({ type: "OPEN", mode: "add-location" }), []);
  const openEditLoc = useCallback(
    (id: string) => dispatchSheet({ type: "OPEN", mode: "edit-location", entityId: id }),
    [],
  );
  const openAddField = useCallback((locationId?: string) => {
    setFieldDefaultLoc(locationId);
    dispatchSheet({ type: "OPEN", mode: "add-field" });
  }, []);
  const openEditField = useCallback(
    (id: string) => dispatchSheet({ type: "OPEN", mode: "edit-field", entityId: id }),
    [],
  );

  const editingLoc =
    sheet.mode === "edit-location" ? resolveEntityById(locations, sheet.entityId) : null;
  const allFields = locations.flatMap((l) => l.fields);
  const editingField =
    sheet.mode === "edit-field" ? resolveEntityById(allFields, sheet.entityId) : null;

  useEffect(() => {
    if (sheet.mode === "edit-location" && sheet.open && sheet.entityId && !editingLoc) {
      dispatchSheet({ type: "ENTITY_GONE" });
    }
  }, [sheet, editingLoc]);

  useEffect(() => {
    if (sheet.mode === "edit-field" && sheet.open && sheet.entityId && !editingField) {
      dispatchSheet({ type: "ENTITY_GONE" });
    }
  }, [sheet, editingField]);

  function toggle(id: string) {
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
        eyebrow={tournamentName}
        title="Locations"
        description="Manage park sites here; diamonds live under each location."
        meta={`${locations.length} location${locations.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <>
              <Link href="/admin/fields" className={btnSecondary}>
                Fields
              </Link>
              <Link href={tournamentPathFromBase(publicSitePath, "locations")} className={btnSecondary}>
                Public page ↗
              </Link>
              <button type="button" onClick={openAddLoc} className={btnPrimary}>
                Add location
              </button>
            </>
          ) : (
            <Link href={tournamentPathFromBase(publicSitePath, "locations")} className={btnSecondary}>
              Public page ↗
            </Link>
          )
        }
      />

      {!canManage ? (
        <p className="text-sm text-zinc-600">You don’t have permission to manage locations.</p>
      ) : locations.length === 0 ? (
        <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-zinc-700">No locations yet.</p>
          <button type="button" onClick={openAddLoc} className={`${btnPrimary} mt-4`}>
            Add location
          </button>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {locations.map((loc, index) => (
            <LocationCard
              key={loc.id}
              location={loc}
              index={index}
              total={locations.length}
              expanded={expanded.has(loc.id)}
              onToggle={() => toggle(loc.id)}
              onEdit={() => openEditLoc(loc.id)}
              onAddField={() => openAddField(loc.id)}
              onEditField={openEditField}
            />
          ))}
        </ul>
      )}

      {sheet.mode === "add-location" ? (
        <AddLocationSheet key={sheet.session} open={sheet.open} onClose={closeSheet} />
      ) : null}
      {sheet.mode === "edit-location" ? (
        <EditLocationSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          location={editingLoc}
        />
      ) : null}
      {sheet.mode === "add-field" ? (
        <AddFieldSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          locations={locations}
          defaultLocationId={fieldDefaultLoc}
        />
      ) : null}
      {sheet.mode === "edit-field" ? (
        <EditFieldSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          field={editingField}
          locations={locations}
        />
      ) : null}
    </div>
  );
}

function LocationCard({
  location: loc,
  index,
  total,
  expanded,
  onToggle,
  onEdit,
  onAddField,
  onEditField,
}: {
  location: LocationWithFields;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddField: () => void;
  onEditField: (id: string) => void;
}) {
  const [upState, upAction, upPending] = useActionState(moveVenue, undefined as ContentActionResult | undefined);
  const [downState, downAction, downPending] = useActionState(
    moveVenue,
    undefined as ContentActionResult | undefined,
  );
  const addr = shortAddress(loc.address);
  const mapOk = hasMapLinkAvailability(loc);

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">{loc.name}</h2>
            {loc.isHeadquarters ? <StatusBadge tone="success">Headquarters</StatusBadge> : null}
          </div>
          <p className="mt-1 text-sm text-zinc-600">{addr || "No address"}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {loc.fields.length} field{loc.fields.length === 1 ? "" : "s"}
            <span aria-hidden> · </span>
            {mapOk ? "Map available" : "No map link"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReorderMenu
            label={`Reorder ${loc.name}`}
            error={actionError(upState) ?? actionError(downState)}
          >
            <form action={upAction}>
              <input type="hidden" name="id" value={loc.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={upPending || index === 0}
                className="flex h-10 w-full items-center rounded px-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
              >
                Move up
              </button>
            </form>
            <form action={downAction}>
              <input type="hidden" name="id" value={loc.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={downPending || index >= total - 1}
                className="flex h-10 w-full items-center rounded px-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
              >
                Move down
              </button>
            </form>
          </ReorderMenu>
          <button type="button" onClick={onEdit} className={btnSecondary + " h-10 px-3 text-xs"}>
            Edit
          </button>
          <button type="button" onClick={onToggle} aria-expanded={expanded} className={btnGhost + " h-10"}>
            {expanded ? "Hide fields" : "Show fields"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fields</h3>
            <button type="button" onClick={onAddField} className={btnSecondary + " h-9 px-3 text-xs"}>
              Add field
            </button>
          </div>
          {loc.fields.length === 0 ? (
            <p className="text-sm text-zinc-500">No fields at this location yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {loc.fields.map((f, idx) => (
                <FieldSummaryRow
                  key={f.id}
                  field={f}
                  locationName={loc.name}
                  index={idx}
                  total={loc.fields.length}
                  onEdit={() => onEditField(f.id)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}
