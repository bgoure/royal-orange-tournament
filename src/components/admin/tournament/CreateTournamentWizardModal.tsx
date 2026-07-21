"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { createTournamentFromWizard } from "@/app/admin/_actions/tournament-wizard";
import { SetupChecklistPanel } from "@/components/admin/tournament/SetupChecklistPanel";
import {
  setupChecklistDismissKey,
  type SetupProgress,
} from "@/lib/admin-setup-checklist";
import {
  WIZARD_MAX_DIVISIONS,
  WIZARD_MAX_FIELDS,
  WIZARD_MAX_POOLS_PER_DIVISION,
  WIZARD_MAX_TEAMS_PER_POOL,
  WIZARD_MAX_TEAMS_TOURNAMENT,
  type TournamentWizardInput,
} from "@/lib/validations/tournament-wizard";
import { isValidEntryTeamCount } from "@/lib/services/bracket-engine";
import { estimateScheduleCapacity } from "@/lib/services/round-robin-schedule";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
] as const;

export type PoolDraft = {
  name: string;
  teamsAdvancing: string;
  usePlaceholders: boolean;
  /** Used when usePlaceholders is true. */
  teamCount: string;
  /** One name per line when usePlaceholders is false. */
  teamNamesText: string;
};

function parseTeamNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, WIZARD_MAX_TEAMS_PER_POOL);
}

const defaultPool = (index: number): PoolDraft => ({
  name: `Pool ${String.fromCharCode(65 + index)}`,
  teamsAdvancing: "2",
  usePlaceholders: false,
  teamCount: "4",
  teamNamesText: "",
});

type Props = { onClose: () => void };

export function CreateTournamentWizardModal({ onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [setupProgress, setSetupProgress] = useState<SetupProgress | null>(null);
  const [finishNotes, setFinishNotes] = useState<string[]>([]);

  const [tournamentName, setTournamentName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);
  const [fieldCount, setFieldCount] = useState("2");
  const [slotMinutes, setSlotMinutes] = useState("90");
  const [gameDurationMinutes, setGameDurationMinutes] = useState("75");
  const [minRestMinutes, setMinRestMinutes] = useState("30");
  const [travelMinutesBetweenFields, setTravelMinutesBetweenFields] = useState("10");
  const [dayStartTime, setDayStartTime] = useState("08:00");
  const [dayEndTime, setDayEndTime] = useState("18:00");

  const [multipleDivisions, setMultipleDivisions] = useState(false);
  const [divisionNames, setDivisionNames] = useState<string[]>(["Main"]);

  const [poolsByDivision, setPoolsByDivision] = useState<PoolDraft[][]>([[defaultPool(0)]]);

  const [generateSchedules, setGenerateSchedules] = useState(true);
  const [createBrackets, setCreateBrackets] = useState(false);

  const syncPoolsShape = useCallback((names: string[], prevPools: PoolDraft[][]) => {
    return names.map((_, i) => {
      const existing = prevPools[i];
      if (existing && existing.length > 0) return existing;
      return [defaultPool(0)];
    });
  }, []);

  const poolTeamCount = (p: PoolDraft) =>
    p.usePlaceholders ? Number(p.teamCount) || 0 : parseTeamNames(p.teamNamesText).length;

  const totalTeams = useMemo(() => {
    return poolsByDivision.reduce(
      (sum, pools) => sum + pools.reduce((s, p) => s + poolTeamCount(p), 0),
      0,
    );
  }, [poolsByDivision]);

  const allPoolsHaveTwoPlusNamed = useMemo(() => {
    return poolsByDivision.every((pools) =>
      pools.every((p) => !p.usePlaceholders && parseTeamNames(p.teamNamesText).length >= 2),
    );
  }, [poolsByDivision]);

  const advancingByDivision = useMemo(() => {
    return divisionNames.map((_, di) =>
      (poolsByDivision[di] ?? []).reduce((sum, p) => sum + (Number(p.teamsAdvancing) || 0), 0),
    );
  }, [divisionNames, poolsByDivision]);

  const bracketsPossible = advancingByDivision.some((n) => isValidEntryTeamCount(n));

  const scheduleCapacity = useMemo(() => {
    if (!startDate || !endDate || dayStartTime >= dayEndTime) {
      return null;
    }
    const fc = Number(fieldCount) || 1;
    const sm = Number(slotMinutes) || 90;
    const gd = Number(gameDurationMinutes) || 75;
    const rest = Number(minRestMinutes) || 0;
    const travel = Number(travelMinutesBetweenFields) || 0;
    const poolCounts: number[] = [];
    for (const pools of poolsByDivision) {
      for (const p of pools) {
        poolCounts.push(poolTeamCount(p));
      }
    }
    return estimateScheduleCapacity({
      poolTeamCounts: poolCounts,
      fieldCount: fc,
      timezone,
      startDateYmd: startDate,
      endDateYmd: endDate,
      dayStartHm: dayStartTime,
      dayEndHm: dayEndTime,
      slotMinutes: sm,
      gameDurationMinutes: gd,
      minRestMinutes: rest,
      travelMinutesBetweenFields: travel,
    });
  }, [
    startDate,
    endDate,
    dayStartTime,
    dayEndTime,
    fieldCount,
    slotMinutes,
    gameDurationMinutes,
    minRestMinutes,
    travelMinutesBetweenFields,
    timezone,
    poolsByDivision,
  ]);

  const addDivision = () => {
    if (divisionNames.length >= WIZARD_MAX_DIVISIONS) return;
    setDivisionNames((d) => {
      const next = [...d, `Division ${d.length + 1}`];
      setPoolsByDivision((p) => syncPoolsShape(next, p));
      return next;
    });
  };

  const removeDivision = (index: number) => {
    if (divisionNames.length <= 1) return;
    setDivisionNames((d) => {
      const next = d.filter((_, i) => i !== index);
      setPoolsByDivision((p) => p.filter((_, i) => i !== index));
      return next;
    });
  };

  const updateDivisionName = (index: number, name: string) => {
    setDivisionNames((d) => d.map((x, i) => (i === index ? name : x)));
  };

  const addPool = (divisionIndex: number) => {
    setPoolsByDivision((rows) =>
      rows.map((pools, i) => {
        if (i !== divisionIndex) return pools;
        if (pools.length >= WIZARD_MAX_POOLS_PER_DIVISION) return pools;
        return [...pools, defaultPool(pools.length)];
      }),
    );
  };

  const removePool = (divisionIndex: number, poolIndex: number) => {
    setPoolsByDivision((rows) =>
      rows.map((pools, i) => {
        if (i !== divisionIndex) return pools;
        if (pools.length <= 1) return pools;
        return pools.filter((_, j) => j !== poolIndex);
      }),
    );
  };

  const updatePool = (divisionIndex: number, poolIndex: number, patch: Partial<PoolDraft>) => {
    setPoolsByDivision((rows) =>
      rows.map((pools, i) => {
        if (i !== divisionIndex) return pools;
        return pools.map((pool, j) => (j === poolIndex ? { ...pool, ...patch } : pool));
      }),
    );
  };

  const buildPayload = (): TournamentWizardInput => ({
    tournamentName: tournamentName.trim(),
    venueName: venueName.trim(),
    venueAddress: venueAddress.trim(),
    startDate,
    endDate,
    timezone,
    fieldCount: Number(fieldCount),
    slotMinutes: Number(slotMinutes),
    gameDurationMinutes: Number(gameDurationMinutes),
    minRestMinutes: Number(minRestMinutes),
    travelMinutesBetweenFields: Number(travelMinutesBetweenFields),
    dayStartTime,
    dayEndTime,
    generateSchedules,
    createBrackets,
    divisions: divisionNames.map((name, di) => ({
      name: name.trim(),
      pools: (poolsByDivision[di] ?? []).map((p) => {
        if (p.usePlaceholders) {
          return {
            name: p.name.trim(),
            teamsAdvancing: Number(p.teamsAdvancing),
            usePlaceholders: true,
            teamCount: Number(p.teamCount),
            teamNames: [],
          };
        }
        return {
          name: p.name.trim(),
          teamsAdvancing: Number(p.teamsAdvancing),
          usePlaceholders: false,
          teamNames: parseTeamNames(p.teamNamesText),
        };
      }),
    })),
  });

  const canAdvanceFromStep0 =
    tournamentName.trim() &&
    venueName.trim() &&
    venueAddress.trim() &&
    startDate &&
    endDate &&
    endDate >= startDate &&
    Number(fieldCount) >= 1 &&
    Number(fieldCount) <= WIZARD_MAX_FIELDS &&
    Number(slotMinutes) >= 15 &&
    Number(gameDurationMinutes) >= 15 &&
    Number(minRestMinutes) >= 0 &&
    Number(travelMinutesBetweenFields) >= 0 &&
    dayStartTime &&
    dayEndTime &&
    dayStartTime < dayEndTime;

  const canAdvanceFromStep1 =
    divisionNames.length > 0 &&
    divisionNames.length <= WIZARD_MAX_DIVISIONS &&
    divisionNames.every((n) => n.trim().length > 0);

  const canAdvanceFromStep2 =
    poolsByDivision.length === divisionNames.length &&
    totalTeams <= WIZARD_MAX_TEAMS_TOURNAMENT &&
    poolsByDivision.every((pools) =>
      pools.every((p) => {
        const ta = Number(p.teamsAdvancing);
        if (!p.name.trim() || !Number.isFinite(ta) || ta < 0) return false;
        const tc = poolTeamCount(p);
        if (tc < 1 || tc > WIZARD_MAX_TEAMS_PER_POOL) return false;
        if (ta > tc) return false;
        return true;
      }),
    );

  const goNext = () => {
    setFormError(null);
    if (step === 0 && !canAdvanceFromStep0) {
      setFormError(
        "Fill in venue, dates, field count, slot length, and daily hours (end must be after start).",
      );
      return;
    }
    if (step === 1 && !canAdvanceFromStep1) {
      setFormError("Each division needs a name.");
      return;
    }
    if (step === 2 && !canAdvanceFromStep2) {
      setFormError(
        `Each pool needs a name, at least one team (names or placeholders), and advancing ≤ team count. Max ${WIZARD_MAX_TEAMS_TOURNAMENT} teams total.`,
      );
      return;
    }
    if (step === 2) {
      setGenerateSchedules(allPoolsHaveTwoPlusNamed);
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const goBack = () => {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    setFormError(null);
    setPending(true);
    try {
      const result = await createTournamentFromWizard(buildPayload());
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      try {
        localStorage.removeItem(setupChecklistDismissKey(result.slug));
      } catch {
        /* ignore */
      }
      setCreatedSlug(result.slug);
      setSetupProgress(result.setupProgress);
      setFinishNotes(result.finishNotes);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const finishAfterChecklist = () => {
    onClose();
    router.refresh();
  };

  if (createdSlug && setupProgress) {
    const publicPath = `/${createdSlug}`;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-checklist-title"
      >
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Tournament created</p>
          <h2 id="setup-checklist-title" className="mt-1 text-xl font-semibold text-zinc-900">
            Next steps
          </h2>
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Public URL path</p>
            <p className="mt-1 font-mono text-sm font-semibold text-zinc-900">{publicPath}</p>
            <p className="mt-1.5 text-xs text-zinc-600">
              Derived from the tournament name (lowercase, hyphenated). Share this path with parents — it is how
              people open your event (not the site home page).
            </p>
          </div>
          {finishNotes.length > 0 ? (
            <ul className="mt-3 space-y-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
              {finishNotes.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4">
            <SetupChecklistPanel progress={setupProgress} />
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <a
              href={publicPath}
              className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              Open public site
            </a>
            <button
              type="button"
              onClick={finishAfterChecklist}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continue to admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white px-6 py-4">
          <div>
            <h2 id="wizard-title" className="text-lg font-semibold text-zinc-900">
              Create tournament
            </h2>
            <p className="text-xs text-zinc-500">
              Step {step + 1} of 4
              {step === 3 ? " — review & optional schedule" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {formError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>
          ) : null}

          {step === 0 ? (
            <>
              <label className="block text-sm font-medium text-zinc-700">
                Tournament name
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Spring Classic 2026"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Venue / park name (headquarters)
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Milton Sports Park"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Headquarters address
                <textarea
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  rows={3}
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Street, city, province/state"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-zinc-700">
                  Start date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  End date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-zinc-700">
                Timezone
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Fields &amp; schedule window
                </p>
                <p className="text-xs text-zinc-500">
                  Used if you generate round-robin schedules. Games start only between daily hours. Rest and field
                  travel keep teams from being scheduled too tightly when they move diamonds.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-zinc-700">
                    Number of fields
                    <input
                      type="number"
                      min={1}
                      max={WIZARD_MAX_FIELDS}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={fieldCount}
                      onChange={(e) => setFieldCount(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-700">
                    Slot / changeover (min)
                    <input
                      type="number"
                      min={15}
                      max={360}
                      step={5}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={slotMinutes}
                      onChange={(e) => setSlotMinutes(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-700">
                    Game length (min)
                    <input
                      type="number"
                      min={15}
                      max={360}
                      step={5}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={gameDurationMinutes}
                      onChange={(e) => setGameDurationMinutes(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-700">
                    Rest between games (min)
                    <input
                      type="number"
                      min={0}
                      max={240}
                      step={5}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={minRestMinutes}
                      onChange={(e) => setMinRestMinutes(e.target.value)}
                      title="After a game ends, minimum break before that team starts again"
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-700">
                    Travel between fields (min)
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={5}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={travelMinutesBetweenFields}
                      onChange={(e) => setTravelMinutesBetweenFields(e.target.value)}
                      title="Extra time when a team’s next game is on a different field"
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-700">
                    Daily first pitch
                    <input
                      type="time"
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={dayStartTime}
                      onChange={(e) => setDayStartTime(e.target.value)}
                    />
                  </label>
                  <label className="col-span-2 block text-sm font-medium text-zinc-700 sm:col-span-1">
                    No new games after
                    <input
                      type="time"
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={dayEndTime}
                      onChange={(e) => setDayEndTime(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={multipleDivisions}
                  onChange={(e) => {
                    const multi = e.target.checked;
                    setMultipleDivisions(multi);
                    if (!multi) {
                      const single = divisionNames[0]?.trim() || tournamentName.trim() || "Main";
                      setDivisionNames([single]);
                      setPoolsByDivision((p) => syncPoolsShape([single], p));
                    } else if (divisionNames.length === 1) {
                      setDivisionNames(["10U", "12U"]);
                      setPoolsByDivision((p) => syncPoolsShape(["10U", "12U"], p));
                    }
                  }}
                />
                Multiple age divisions (e.g. 10U, 12U)
              </label>
              <div className="space-y-3">
                {divisionNames.map((name, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={name}
                      onChange={(e) => updateDivisionName(i, e.target.value)}
                      aria-label={`Division ${i + 1} name`}
                    />
                    {multipleDivisions ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                        onClick={() => removeDivision(i)}
                        disabled={divisionNames.length <= 1}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
                {multipleDivisions ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-emerald-700 hover:underline disabled:opacity-40"
                    onClick={addDivision}
                    disabled={divisionNames.length >= WIZARD_MAX_DIVISIONS}
                  >
                    + Add division
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <p className="text-xs text-zinc-500">
                Paste one team name per line, or use placeholders and rename later. Cap: {WIZARD_MAX_TEAMS_PER_POOL}{" "}
                teams/pool, {WIZARD_MAX_TEAMS_TOURNAMENT} total ({totalTeams} so far).
              </p>
              {divisionNames.map((divName, di) => (
                <div key={di} className="rounded-xl border border-zinc-200 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">{divName || `Division ${di + 1}`}</h3>
                  <ul className="mt-3 space-y-3">
                    {(poolsByDivision[di] ?? []).map((pool, pi) => (
                      <li key={pi} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase text-zinc-500">Pool</span>
                          {(poolsByDivision[di] ?? []).length > 1 ? (
                            <button
                              type="button"
                              className="text-xs text-red-700 hover:underline"
                              onClick={() => removePool(di, pi)}
                            >
                              Remove pool
                            </button>
                          ) : null}
                        </div>
                        <input
                          className="mb-2 w-full rounded border border-zinc-200 px-2 py-1.5"
                          value={pool.name}
                          onChange={(e) => updatePool(di, pi, { name: e.target.value })}
                          placeholder="Pool name"
                        />
                        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                          <input
                            type="checkbox"
                            checked={pool.usePlaceholders}
                            onChange={(e) =>
                              updatePool(di, pi, { usePlaceholders: e.target.checked })
                            }
                          />
                          Use placeholders + finish later
                        </label>
                        {pool.usePlaceholders ? (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-zinc-600">
                              Team count
                              <input
                                type="number"
                                min={1}
                                max={WIZARD_MAX_TEAMS_PER_POOL}
                                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5"
                                value={pool.teamCount}
                                onChange={(e) => updatePool(di, pi, { teamCount: e.target.value })}
                              />
                            </label>
                            <label className="text-xs text-zinc-600">
                              Advancing
                              <input
                                type="number"
                                min={0}
                                max={WIZARD_MAX_TEAMS_PER_POOL}
                                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5"
                                value={pool.teamsAdvancing}
                                onChange={(e) =>
                                  updatePool(di, pi, { teamsAdvancing: e.target.value })
                                }
                              />
                            </label>
                          </div>
                        ) : (
                          <>
                            <label className="block text-xs text-zinc-600">
                              Team names (one per line)
                              <textarea
                                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 font-mono text-sm"
                                rows={4}
                                value={pool.teamNamesText}
                                onChange={(e) =>
                                  updatePool(di, pi, { teamNamesText: e.target.value })
                                }
                                placeholder={"Raptors\nThunder\nAces\nWolves"}
                              />
                            </label>
                            <p className="mt-1 text-[10px] text-zinc-500">
                              {parseTeamNames(pool.teamNamesText).length} team
                              {parseTeamNames(pool.teamNamesText).length === 1 ? "" : "s"}
                            </p>
                            <label className="mt-2 block text-xs text-zinc-600">
                              Advancing to playoffs
                              <input
                                type="number"
                                min={0}
                                max={WIZARD_MAX_TEAMS_PER_POOL}
                                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5"
                                value={pool.teamsAdvancing}
                                onChange={(e) =>
                                  updatePool(di, pi, { teamsAdvancing: e.target.value })
                                }
                              />
                            </label>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-emerald-700 hover:underline disabled:opacity-40"
                    onClick={() => addPool(di)}
                    disabled={(poolsByDivision[di] ?? []).length >= WIZARD_MAX_POOLS_PER_DIVISION}
                  >
                    + Add pool
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4 text-sm text-zinc-700">
              <div className="space-y-2">
                <p>
                  <strong>Name:</strong> {tournamentName}
                </p>
                <p>
                  <strong>Venue:</strong> {venueName} — {venueAddress.slice(0, 80)}
                  {venueAddress.length > 80 ? "…" : ""}
                </p>
                <p>
                  <strong>Dates:</strong> {startDate} → {endDate} ({timezone})
                </p>
                <p>
                  <strong>Fields:</strong> {fieldCount} · <strong>Games:</strong> {gameDurationMinutes} min ·{" "}
                  <strong>Slots:</strong> {slotMinutes} min · <strong>Rest:</strong> {minRestMinutes} min ·{" "}
                  <strong>Travel:</strong> {travelMinutesBetweenFields} min · <strong>Daily:</strong>{" "}
                  {dayStartTime}–{dayEndTime}
                </p>
                <div className="border-t border-zinc-100 pt-2">
                  <strong className="text-zinc-900">Structure</strong>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-zinc-600">
                    {divisionNames.map((dn, di) => (
                      <li key={di}>
                        {dn}:{" "}
                        {(poolsByDivision[di] ?? [])
                          .map((p) => {
                            const tc = poolTeamCount(p);
                            const mode = p.usePlaceholders ? "placeholders" : "named";
                            return `${p.name} (${tc} ${mode}, ${p.teamsAdvancing} adv.)`;
                          })
                          .join("; ")}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-zinc-500">{totalTeams} teams total</p>
                </div>
              </div>

              {scheduleCapacity && scheduleCapacity.warnings.length > 0 ? (
                <div
                  className={`rounded-xl border px-3 py-3 text-xs ${
                    scheduleCapacity.fits
                      ? "border-zinc-200 bg-zinc-50 text-zinc-600"
                      : "border-amber-300 bg-amber-50 text-amber-950"
                  }`}
                  role="status"
                >
                  <p className="font-semibold">
                    {scheduleCapacity.fits ? "Schedule capacity" : "Schedule warning"}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {scheduleCapacity.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                  {scheduleCapacity.wavesNeeded > 0 ? (
                    <p className="mt-1.5 tabular-nums text-[11px] opacity-80">
                      ~{scheduleCapacity.wavesNeeded} slot(s) needed · {scheduleCapacity.slotsAvailable}{" "}
                      available
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Optional finish
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={generateSchedules}
                    onChange={(e) => setGenerateSchedules(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Generate pool round-robin schedules</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Uses your {fieldCount} field(s), {dayStartTime}–{dayEndTime} daily, {gameDurationMinutes}-min
                      games, {slotMinutes}-min slots, {minRestMinutes}-min team rest, {travelMinutesBetweenFields}-min
                      travel when switching fields. Across {startDate || "…"}–{endDate || "…"}. Needs ≥2 teams per
                      pool.
                      {!allPoolsHaveTwoPlusNamed
                        ? " (Some pools still use placeholders or have fewer than 2 teams.)"
                        : ""}
                      {scheduleCapacity && !scheduleCapacity.fits && generateSchedules
                        ? " Warning: capacity looks short — games may spill outside the window."
                        : ""}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={createBrackets}
                    onChange={(e) => setCreateBrackets(e.target.checked)}
                    disabled={!bracketsPossible}
                  />
                  <span>
                    <span className="font-medium">Create single-elim playoff brackets</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Only when a division’s advancing total is a power of 2 (2–64). Unpublished until you publish.
                      {!bracketsPossible
                        ? " None of your advancing totals qualify yet — adjust advancing counts or create brackets later."
                        : " Apply standings to seeds after pool play finishes."}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={step === 0 ? onClose : goBack}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create tournament"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
