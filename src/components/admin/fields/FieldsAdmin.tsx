"use client";

import { useActionState, useCallback, useEffect, useReducer, useState } from "react";
import Link from "next/link";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { moveField } from "@/app/admin/_actions/fields";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { ReorderMenu } from "@/components/admin/ui/ReorderMenu";
import {
  createInitialEntitySheetState,
  entitySheetReducer,
  resolveEntityById,
} from "@/components/admin/ui/entity-sheet-session";
import {
  AddFieldSheet,
  EditFieldSheet,
  type FieldWithGameCount,
  type LocationWithFields,
} from "@/components/admin/venues/VenuesAdmin";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";

const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

export function FieldsAdmin({
  groups,
  tournamentName,
  publicSitePath,
  canManage,
}: {
  groups: LocationWithFields[];
  tournamentName: string;
  publicSitePath: string;
  canManage: boolean;
}) {
  const [sheet, dispatchSheet] = useReducer(
    (s: ReturnType<typeof createInitialEntitySheetState>, a: Parameters<typeof entitySheetReducer>[1]) =>
      entitySheetReducer(s, a),
    createInitialEntitySheetState(),
  );
  const [defaultLoc, setDefaultLoc] = useState<string | undefined>();

  const closeSheet = useCallback(() => dispatchSheet({ type: "CLOSE" }), []);
  const openAdd = useCallback((locationId?: string) => {
    setDefaultLoc(locationId);
    dispatchSheet({ type: "OPEN", mode: "add-field" });
  }, []);
  const openEdit = useCallback(
    (id: string) => dispatchSheet({ type: "OPEN", mode: "edit-field", entityId: id }),
    [],
  );

  const allFields = groups.flatMap((g) => g.fields);
  const editingField =
    sheet.mode === "edit-field" ? resolveEntityById(allFields, sheet.entityId) : null;

  useEffect(() => {
    if (sheet.mode === "edit-field" && sheet.open && sheet.entityId && !editingField) {
      dispatchSheet({ type: "ENTITY_GONE" });
    }
  }, [sheet, editingField]);

  const totalFields = allFields.length;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={tournamentName}
        title="Fields"
        description="Diamonds and playable fields belong to a location."
        meta={`${totalFields} field${totalFields === 1 ? "" : "s"} across ${groups.length} location${groups.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <>
              <Link href="/admin/locations" className={btnSecondary}>
                Locations
              </Link>
              <Link href={tournamentPathFromBase(publicSitePath, "schedule")} className={btnSecondary}>
                Schedule ↗
              </Link>
              <button
                type="button"
                onClick={() => openAdd()}
                disabled={groups.length === 0}
                className={btnPrimary}
              >
                Add field
              </button>
            </>
          ) : (
            <Link href="/admin/locations" className={btnSecondary}>
              Locations
            </Link>
          )
        }
      />

      {!canManage ? (
        <p className="text-sm text-zinc-600">You don’t have permission to manage fields.</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          Add at least one{" "}
          <Link href="/admin/locations" className="font-semibold underline">
            location
          </Link>{" "}
          before creating fields.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((loc) => (
            <section key={loc.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-900">{loc.name}</h2>
                  {loc.isHeadquarters ? <StatusBadge tone="success">HQ</StatusBadge> : null}
                  <span className="text-xs text-zinc-500">
                    {loc.fields.length} field{loc.fields.length === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openAdd(loc.id)}
                  className={btnSecondary + " h-9 px-3 text-xs"}
                >
                  Add field
                </button>
              </div>
              <div className="bg-zinc-50/50 px-4 py-4 sm:px-5">
                {loc.fields.length === 0 ? (
                  <p className="text-sm text-zinc-500">No fields at this location yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {loc.fields.map((f, idx) => (
                      <FieldRow
                        key={f.id}
                        field={f}
                        locationName={loc.name}
                        index={idx}
                        total={loc.fields.length}
                        onEdit={() => openEdit(f.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {sheet.mode === "add-field" ? (
        <AddFieldSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          locations={groups}
          defaultLocationId={defaultLoc}
        />
      ) : null}
      {sheet.mode === "edit-field" ? (
        <EditFieldSheet
          key={sheet.session}
          open={sheet.open}
          onClose={closeSheet}
          field={editingField}
          locations={groups}
        />
      ) : null}
    </div>
  );
}

function FieldRow({
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
          error={
            (upState && !upState.ok ? upState.error : undefined) ??
            (downState && !downState.ok ? downState.error : undefined)
          }
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
