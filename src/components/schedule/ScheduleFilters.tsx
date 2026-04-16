"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { tournamentPath } from "@/lib/tournament-public-path";

type TeamOpt = { id: string; name: string };
type FieldOpt = { id: string; label: string };
type DayOpt = { value: string; label: string };

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

  const push = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (!v) params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => {
        router.push(`${tournamentPath(tournamentSlug, "schedule")}?${params.toString()}`);
      });
    },
    [router, sp, tournamentSlug],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Day
          <select
            className="min-h-11 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900"
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
            className="min-h-11 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900"
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
            className="min-h-11 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900"
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
