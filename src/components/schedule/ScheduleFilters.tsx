"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Drawer } from "vaul";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";

export type ScheduleFiltersPathSegment = "schedule" | "results";

type TeamOpt = { id: string; name: string };
type FieldOpt = { id: string; label: string };
type DayOpt = { value: string; label: string; summaryLabel: string };

type DrawerKind = "date" | "field" | "team";

const drawerSectionTitle = "text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400";

const filterChipRail =
  "rounded-2xl border border-white/50 bg-gradient-to-b from-zinc-100/80 to-zinc-50/75 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md dark:border-zinc-600/45 dark:from-zinc-800/60 dark:to-zinc-900/55";

const filterChipBase =
  "min-h-[48px] md:min-h-11 flex flex-1 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const filterChipInactive =
  "text-zinc-600 hover:bg-white/55 hover:text-zinc-900 hover:shadow-sm active:scale-[0.98]";

const filterChipActive =
  "bg-white text-royal shadow-[0_2px_10px_rgba(30,58,138,0.14),0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-zinc-200/70 ring-inset";

const filterOptionBtn =
  "group w-full rounded-xl border border-white/45 bg-white/82 px-4 py-3.5 text-left text-sm font-medium text-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md transition-all duration-200 hover:border-royal/35 hover:shadow-[0_4px_14px_rgba(30,58,138,0.08)] active:scale-[0.995] dark:border-zinc-600/50 dark:bg-zinc-900/72";

const filterOptionBtnActive =
  "border-royal/45 bg-gradient-to-br from-royal-50/90 via-white to-white font-semibold text-royal shadow-[0_4px_16px_rgba(30,58,138,0.12)] ring-2 ring-royal/20";

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
  publicBasePath,
  dayOptions,
  teams,
  fields,
  pathSegment = "schedule",
  filtersAriaLabel = "Schedule filters",
}: {
  publicBasePath: string;
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
      const base = tournamentPathFromBase(publicBasePath, pathSegment);
      const href = qs ? `${base}?${qs}` : base;
      startTransition(() => {
        router.push(href);
        if (closeDrawer) {
          setDrawerOpenedAtSp(null);
          setActiveDrawer(null);
        }
      });
    },
    [pathSegment, router, sp, publicBasePath],
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
        className={`flex min-w-0 gap-1 ${filterChipRail}`}
        role="group"
        aria-label={filtersAriaLabel}
      >
        <button
          type="button"
          disabled={pending}
          onClick={() => openDrawer("date")}
          className={["group", filterChipBase, day ? filterChipActive : filterChipInactive].join(" ")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`size-4 shrink-0 ${day ? "text-royal" : "text-zinc-400 group-hover:text-zinc-600"}`}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="truncate">Date</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => openDrawer("field")}
          className={["group", filterChipBase, fieldId ? filterChipActive : filterChipInactive].join(" ")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`size-4 shrink-0 ${fieldId ? "text-royal" : "text-zinc-400 group-hover:text-zinc-600"}`}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">Field</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => openDrawer("team")}
          className={["group", filterChipBase, teamId ? filterChipActive : filterChipInactive].join(" ")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`size-4 shrink-0 ${teamId ? "text-royal" : "text-zinc-400 group-hover:text-zinc-600"}`}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">Team</span>
        </button>
      </div>

      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug text-zinc-500">
          {summaryLine ?? (
            <span className="text-zinc-400">No filters applied — tap a chip to narrow games.</span>
          )}
        </p>
        {hasAnyFilter ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => push({ day: "", team: "", field: "" })}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            aria-label="Clear all filters"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
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
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] mt-24 flex max-h-[85vh] flex-col rounded-t-[1.35rem] border border-b-0 border-zinc-200/80 bg-gradient-to-b from-zinc-50 via-white to-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(15,23,42,0.12)] outline-none">
            <Drawer.Title className="sr-only">
              {activeDrawer === "date"
                ? "Choose date"
                : activeDrawer === "field"
                  ? "Choose field"
                  : activeDrawer === "team"
                    ? "Choose team"
                    : "Schedule filters"}
            </Drawer.Title>
            <Drawer.Handle className="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-zinc-300/90" />
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-5">
              <div className="border-b border-zinc-200/80 pb-4">
                <p className={`${drawerSectionTitle} mb-1.5`}>{drawerHeading}</p>
                <p className="text-lg font-bold tracking-tight text-zinc-900">
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
                <div className="flex flex-col gap-2">
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
                <div className="flex flex-col gap-2">
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
