"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Drawer } from "vaul";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import {
  schedulePillActive,
  schedulePillInactive,
  schedulePillTapMin,
  schedulePillTransition,
} from "@/lib/schedule-pill-styles";
import { tournamentPath } from "@/lib/tournament-public-path";

type TeamOpt = { id: string; name: string };
type FieldOpt = { id: string; label: string };
type DayOpt = { value: string; label: string };

const labelClass = "text-xs font-semibold uppercase tracking-wide text-royal";

const chipRowClass =
  "flex max-w-full flex-nowrap gap-2 overflow-x-auto overflow-y-visible scroll-smooth pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] snap-x snap-mandatory [&::-webkit-scrollbar]:h-1.5";

const drawerSectionTitle = "text-xs font-bold uppercase tracking-wide text-zinc-500";

const filterOptionBtn =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left text-sm font-medium text-zinc-900 transition-colors hover:border-royal/40 hover:bg-royal-50/60";

const filterOptionBtnActive = "border-royal bg-royal-50 ring-2 ring-royal/25";

export function ScheduleFilters({
  tournamentSlug,
  dayOptions,
  teams,
  fields,
}: {
  tournamentSlug: string;
  /** Calendar days (tournament timezone) that have at least one game for the current division scope */
  dayOptions: DayOpt[];
  teams: TeamOpt[];
  fields: FieldOpt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** `spSignature` when the drawer was opened; closes drawer when URL changes (e.g. back/forward). */
  const [filtersOpenedAtSp, setFiltersOpenedAtSp] = useState<string | null>(null);

  const dayKeySet = useMemo(() => new Set(dayOptions.map((d) => d.value)), [dayOptions]);
  const teamIdSet = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);
  const fieldIdSet = useMemo(() => new Set(fields.map((f) => f.id)), [fields]);

  const dayRaw = sp.get("day") ?? "";
  const teamRaw = sp.get("team") ?? "";
  const fieldRaw = sp.get("field") ?? "";

  const day = useMemo(
    () => (dayKeySet.has(dayRaw) ? dayRaw : ""),
    [dayKeySet, dayRaw],
  );
  const teamId = useMemo(
    () => (teamIdSet.has(teamRaw) ? teamRaw : ""),
    [teamIdSet, teamRaw],
  );
  const fieldId = useMemo(
    () => (fieldIdSet.has(fieldRaw) ? fieldRaw : ""),
    [fieldIdSet, fieldRaw],
  );

  const activeFilterCount = (teamId ? 1 : 0) + (fieldId ? 1 : 0);

  const spSignature = sp.toString();

  if (filtersOpen && filtersOpenedAtSp !== null && filtersOpenedAtSp !== spSignature) {
    setFiltersOpenedAtSp(null);
    setFiltersOpen(false);
  }

  const push = useCallback(
    (next: Record<string, string>, closeDrawer?: boolean) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (!v) params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => {
        router.push(`${tournamentPath(tournamentSlug, "schedule")}?${params.toString()}`);
        if (closeDrawer) {
          setFiltersOpenedAtSp(null);
          setFiltersOpen(false);
        }
      });
    },
    [router, sp, tournamentSlug],
  );

  const dayChips: { value: string; label: string }[] = useMemo(
    () => [{ value: "", label: "All days" }, ...dayOptions],
    [dayOptions],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 flex-1">
          <p className={`${labelClass} mb-1.5`}>Day</p>
          <div
            {...{ [DIVISION_SWIPE_IGNORE]: "" }}
            className={chipRowClass}
            role="listbox"
            aria-label="Filter by day"
          >
            {dayChips.map((o) => {
              const active = o.value === day;
              return (
                <button
                  key={o.value || "all"}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={pending}
                  onClick={() => push({ day: o.value })}
                  className={[
                    schedulePillTapMin,
                    schedulePillTransition,
                    "snap-start shrink-0 rounded-lg px-[14px] py-2.5 text-sm sm:text-base",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
                    active ? schedulePillActive : schedulePillInactive,
                  ].join(" ")}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:pt-6">
          <button
            type="button"
            disabled={pending}
            onClick={() => setFiltersOpen(true)}
            className={[
              schedulePillTapMin,
              schedulePillTransition,
              "inline-flex items-center gap-2 rounded-lg border-2 border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-800",
              "hover:border-zinc-300 hover:bg-zinc-200 disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
            ].join(" ")}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="size-5 shrink-0 text-royal"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-royal px-2 py-0.5 text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <Drawer.Root
        open={filtersOpen}
        onOpenChange={(open) => {
          setFiltersOpen(open);
          setFiltersOpenedAtSp(open ? spSignature : null);
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex max-h-[85vh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] outline-none">
            <Drawer.Title className="sr-only">Schedule filters</Drawer.Title>
            <Drawer.Handle className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-zinc-300" />
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <p className="text-base font-semibold text-zinc-900">Team &amp; field</p>
                <button
                  type="button"
                  className="text-sm font-medium text-royal hover:underline"
                  onClick={() => push({ team: "", field: "" }, true)}
                  disabled={pending || (!teamId && !fieldId)}
                >
                  Clear all
                </button>
              </div>

              <div>
                <p className={`${drawerSectionTitle} mb-2`}>Team</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    className={`${filterOptionBtn} ${!teamId ? filterOptionBtnActive : ""}`}
                    onClick={() => push({ team: "" }, true)}
                  >
                    All teams
                  </button>
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={pending}
                      className={`${filterOptionBtn} ${teamId === t.id ? filterOptionBtnActive : ""}`}
                      onClick={() => push({ team: t.id }, true)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={`${drawerSectionTitle} mb-2`}>Field</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    className={`${filterOptionBtn} ${!fieldId ? filterOptionBtnActive : ""}`}
                    onClick={() => push({ field: "" }, true)}
                  >
                    All fields
                  </button>
                  {fields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={pending}
                      className={`${filterOptionBtn} ${fieldId === f.id ? filterOptionBtnActive : ""}`}
                      onClick={() => push({ field: f.id }, true)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
