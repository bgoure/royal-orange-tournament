"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import { ALL_DIVISIONS_TAB_ID } from "@/lib/division-tabs";

type TeamOpt = { id: string; name: string };
type FieldOpt = { id: string; label: string };
type DivisionTabOpt = { id: string; name: string };

export function ScheduleFilters({
  teams,
  fields,
  timezone,
  divisionTabs,
  serverResolvedDivisionId,
}: {
  teams: TeamOpt[];
  fields: FieldOpt[];
  timezone: string;
  /** When length &gt; 1, shows division pills (All + divisions) like standings. */
  divisionTabs: DivisionTabOpt[];
  /** URL + cookie resolution from server (keeps pills in sync when query is empty). */
  serverResolvedDivisionId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const day = sp.get("day") ?? "";
  const teamId = sp.get("team") ?? "";
  const fieldId = sp.get("field") ?? "";
  const divisionIdRaw = sp.get("division") ?? "";

  const tabsWithAll = useMemo(() => {
    if (divisionTabs.length <= 1) return [];
    return [{ id: ALL_DIVISIONS_TAB_ID, name: "All" }, ...divisionTabs];
  }, [divisionTabs]);

  const activeDivisionIndex = useMemo(() => {
    if (tabsWithAll.length === 0) return 0;
    const idForPill =
      divisionIdRaw ||
      (serverResolvedDivisionId === ALL_DIVISIONS_TAB_ID ? "" : serverResolvedDivisionId);
    if (!idForPill || idForPill === ALL_DIVISIONS_TAB_ID) return 0;
    const i = tabsWithAll.findIndex((t) => t.id === idForPill);
    return i >= 0 ? i : 0;
  }, [divisionIdRaw, serverResolvedDivisionId, tabsWithAll]);

  const dayOptions = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const labels = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const out: { value: string; label: string }[] = [];
    const base = new Date();
    for (let i = -1; i <= 5; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const value = fmt.format(d);
      out.push({ value, label: labels.format(d) });
    }
    return out;
  }, [timezone]);

  const push = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (!v) params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => {
        router.push(`/schedule?${params.toString()}`);
      });
    },
    [router, sp],
  );

  const selectDivision = useCallback(
    (id: string) => {
      startTransition(async () => {
        await setSelectedDivisionTabId(id);
        const params = new URLSearchParams(sp.toString());
        if (id === ALL_DIVISIONS_TAB_ID) params.delete("division");
        else params.set("division", id);
        router.push(`/schedule?${params.toString()}`);
      });
    },
    [router, sp],
  );

  return (
    <div className="flex flex-col gap-4">
      {tabsWithAll.length > 1 ? (
        <div
          className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3"
          role="tablist"
          aria-label="Divisions"
        >
          {tabsWithAll.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={i === activeDivisionIndex}
              disabled={pending}
              onClick={() => selectDivision(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === activeDivisionIndex
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Day
        <select
          className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900"
          disabled={pending}
          value={day}
          onChange={(e) => push({ day: e.target.value })}
        >
          <option value="">All days</option>
          {dayOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Team
        <select
          className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900"
          disabled={pending}
          value={teamId}
          onChange={(e) => push({ team: e.target.value })}
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Field
        <select
          className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900"
          disabled={pending}
          value={fieldId}
          onChange={(e) => push({ field: e.target.value })}
        >
          <option value="">All fields</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      </div>
    </div>
  );
}
