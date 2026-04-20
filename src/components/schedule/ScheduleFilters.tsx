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

export type ScheduleFiltersPathSegment = "schedule" | "results";

type TeamOpt = { id: string; name: string };
type FieldOpt = { id: string; label: string };
type DayOpt = { value: string; label: string; summaryLabel: string };

type DrawerKind = "date" | "field" | "team";

const drawerSectionTitle = "text-xs font-bold uppercase tracking-wide text-zinc-500";

const filterOptionBtn =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left text-sm font-medium text-zinc-900 transition-colors hover:border-royal/40 hover:bg-royal-50/60";

const filterOptionBtnActive = "border-royal bg-royal-50 ring-2 ring-royal/25";

function buildScheduleFilterSummaryLine(
  day: string,
  teamId: string,
  fieldId: string,
  dayOptions: DayOpt[],
  teams: TeamOpt[],
  fields: FieldOpt[],
): string | null {
  const hasDay = Boolean(day);
  const hasTeam = Boolean(teamId);
  const hasField = Boolean(fieldId);
  if (!hasDay && !hasTeam && !hasField) return null;

  const daySummary = dayOptions.find((d) => d.value === day)?.summaryLabel ?? day;
  const teamName = teams.find((t) => t.id === teamId)?.name;
  const fieldLabel = fields.find((f) => f.id === fieldId)?.label;

  if (hasTeam && hasField && hasDay) {
    return `Filtered for: ${teamName ?? "Team"} at ${fieldLabel ?? "Field"} on ${daySummary}`;
  }
  if (hasTeam && hasDay && !hasField) {
    return `Filtered for: ${teamName ?? "Team"} on ${daySummary}`;
  }
  if (hasTeam && hasField && !hasDay) {
    return `Filtered for: ${teamName ?? "Team"} at ${fieldLabel ?? "Field"}`;
  }
  if (hasField && hasDay && !hasTeam) {
    return `Filtered for: Games at ${fieldLabel ?? "Field"} on ${daySummary}`;
  }
  if (hasTeam && !hasField && !hasDay) {
    return `Filtered for: ${teamName ?? "Team"}`;
  }
  if (hasField && !hasTeam && !hasDay) {
    return `Filtered for: Games at ${fieldLabel ?? "Field"}`;
  }
  if (hasDay && !hasTeam && !hasField) {
    return `Filtered for: Games on ${daySummary}`;
  }
  return null;
}

export function ScheduleFilters({
  tournamentSlug,
  dayOptions,
  teams,
  fields,
  pathSegment = "schedule",
  filtersAriaLabel = "Schedule filters",
}: {
  tournamentSlug: string;
  /** Calendar days (tournament timezone) that have at least one game for the current division scope */
  dayOptions: DayOpt[];
  teams: TeamOpt[];
  fields: FieldOpt[];
  /** Public route under the tournament slug; controls `router.push` targets. */
  pathSegment?: ScheduleFiltersPathSegment;
  filtersAriaLabel?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [activeDrawer, setActiveDrawer] = useState<DrawerKind | null>(null);
  /** `spSignature` when a drawer was opened; closes when URL changes (e.g. back/forward). */
  const [drawerOpenedAtSp, setDrawerOpenedAtSp] = useState<string | null>(null);

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

  const spSignature = sp.toString();

  if (activeDrawer && drawerOpenedAtSp !== null && drawerOpenedAtSp !== spSignature) {
    setDrawerOpenedAtSp(null);
    setActiveDrawer(null);
  }

  const push = useCallback(
    (next: Record<string, string>, closeDrawer?: boolean) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (!v) params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      const base = tournamentPath(tournamentSlug, pathSegment);
      const href = qs ? `${base}?${qs}` : base;
      startTransition(() => {
        router.push(href);
        if (closeDrawer) {
          setDrawerOpenedAtSp(null);
          setActiveDrawer(null);
        }
      });
    },
    [pathSegment, router, sp, tournamentSlug],
  );

  const summaryLine = useMemo(
    () => buildScheduleFilterSummaryLine(day, teamId, fieldId, dayOptions, teams, fields),
    [day, dayOptions, fieldId, fields, teamId, teams],
  );

  const hasAnyFilter = summaryLine != null;

  const openDrawer = (kind: DrawerKind) => {
    setActiveDrawer(kind);
    setDrawerOpenedAtSp(spSignature);
  };

  const drawerHeading =
    activeDrawer === "date"
      ? "Date"
      : activeDrawer === "field"
        ? "Field"
        : activeDrawer === "team"
          ? "Team"
          : "";

  return (
    <div className="flex flex-col gap-3">
      <div
        {...{ [DIVISION_SWIPE_IGNORE]: "" }}
        className="flex min-w-0 gap-2"
        role="group"
        aria-label={filtersAriaLabel}
      >
        <button
          type="button"
          disabled={pending}
          onClick={() => openDrawer("date")}
          className={[
            schedulePillTapMin,
            schedulePillTransition,
            "min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium sm:text-base",
            "disabled:pointer-events-none disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
            day ? schedulePillActive : schedulePillInactive,
          ].join(" ")}
        >
          Date
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => openDrawer("field")}
          className={[
            schedulePillTapMin,
            schedulePillTransition,
            "min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium sm:text-base",
            "disabled:pointer-events-none disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
            fieldId ? schedulePillActive : schedulePillInactive,
          ].join(" ")}
        >
          Field
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => openDrawer("team")}
          className={[
            schedulePillTapMin,
            schedulePillTransition,
            "min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium sm:text-base",
            "disabled:pointer-events-none disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
            teamId ? schedulePillActive : schedulePillInactive,
          ].join(" ")}
        >
          Team
        </button>
      </div>

      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm leading-snug text-zinc-500">
          {summaryLine ?? "No filters applied"}
        </p>
        {hasAnyFilter ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => push({ day: "", team: "", field: "" })}
            className="shrink-0 rounded-md p-1 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            aria-label="Clear all filters"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <Drawer.Root
        open={activeDrawer != null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveDrawer(null);
            setDrawerOpenedAtSp(null);
          }
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex max-h-[85vh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] outline-none">
            <Drawer.Title className="sr-only">
              {activeDrawer === "date"
                ? "Choose date"
                : activeDrawer === "field"
                  ? "Choose field"
                  : activeDrawer === "team"
                    ? "Choose team"
                    : "Schedule filters"}
            </Drawer.Title>
            <Drawer.Handle className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-zinc-300" />
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4">
              <div className="border-b border-zinc-100 pb-3">
                <p className={`${drawerSectionTitle} mb-1`}>{drawerHeading}</p>
                <p className="text-base font-semibold text-zinc-900">
                  {activeDrawer === "date"
                    ? "Select a day"
                    : activeDrawer === "field"
                      ? "Select a field"
                      : activeDrawer === "team"
                        ? "Select a team"
                        : ""}
                </p>
              </div>

              {activeDrawer === "date" ? (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    className={`${filterOptionBtn} ${!day ? filterOptionBtnActive : ""}`}
                    onClick={() => push({ day: "" }, true)}
                  >
                    All days
                  </button>
                  {dayOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      disabled={pending}
                      className={`${filterOptionBtn} ${day === o.value ? filterOptionBtnActive : ""}`}
                      onClick={() => push({ day: o.value }, true)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeDrawer === "field" ? (
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
              ) : null}

              {activeDrawer === "team" ? (
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
              ) : null}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
