"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createTournamentFromWizard } from "@/app/admin/_actions/tournament-wizard";
import type { TournamentWizardInput } from "@/lib/validations/tournament-wizard";

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

export type PoolDraft = { name: string; teamCount: string; teamsAdvancing: string };

const defaultPool = (index: number): PoolDraft => ({
  name: `Pool ${String.fromCharCode(65 + index)}`,
  teamCount: "4",
  teamsAdvancing: "2",
});

type Props = { onClose: () => void };

export function CreateTournamentWizardModal({ onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [tournamentName, setTournamentName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);

  const [multipleDivisions, setMultipleDivisions] = useState(false);
  const [divisionNames, setDivisionNames] = useState<string[]>(["Main"]);

  const [poolsByDivision, setPoolsByDivision] = useState<PoolDraft[][]>([[defaultPool(0)]]);

  const syncPoolsShape = useCallback((names: string[], prevPools: PoolDraft[][]) => {
    return names.map((_, i) => {
      const existing = prevPools[i];
      if (existing && existing.length > 0) return existing;
      return [defaultPool(0)];
    });
  }, []);

  const addDivision = () => {
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
      rows.map((pools, i) =>
        i === divisionIndex ? [...pools, defaultPool(pools.length)] : pools,
      ),
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

  const updatePool = (
    divisionIndex: number,
    poolIndex: number,
    patch: Partial<PoolDraft>,
  ) => {
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
    divisions: divisionNames.map((name, di) => ({
      name: name.trim(),
      pools: (poolsByDivision[di] ?? []).map((p) => ({
        name: p.name.trim(),
        teamCount: Number(p.teamCount),
        teamsAdvancing: Number(p.teamsAdvancing),
      })),
    })),
  });

  const canAdvanceFromStep0 =
    tournamentName.trim() &&
    venueName.trim() &&
    venueAddress.trim() &&
    startDate &&
    endDate;

  const canAdvanceFromStep1 =
    divisionNames.length > 0 && divisionNames.every((n) => n.trim().length > 0);

  const canAdvanceFromStep2 =
    poolsByDivision.length === divisionNames.length &&
    poolsByDivision.every((pools) =>
      pools.every((p) => {
        const tc = Number(p.teamCount);
        const ta = Number(p.teamsAdvancing);
        return p.name.trim() && Number.isFinite(tc) && tc >= 1 && Number.isFinite(ta) && ta >= 0 && ta <= tc;
      }),
    );

  const goNext = () => {
    setFormError(null);
    if (step === 0 && !canAdvanceFromStep0) {
      setFormError("Fill in all required fields.");
      return;
    }
    if (step === 1 && !canAdvanceFromStep1) {
      setFormError("Each division needs a name.");
      return;
    }
    if (step === 2 && !canAdvanceFromStep2) {
      setFormError("Each pool needs a name, team count ≥ 1, and advancing count ≤ team count.");
      return;
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
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

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
              Step {step + 1} of 4 — skeleton only (no schedule or bracket yet)
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
                    className="text-sm font-medium text-emerald-700 hover:underline"
                    onClick={addDivision}
                  >
                    + Add division
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              {divisionNames.map((divName, di) => (
                <div key={di} className="rounded-xl border border-zinc-200 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">{divName || `Division ${di + 1}`}</h3>
                  <ul className="mt-3 space-y-3">
                    {(poolsByDivision[di] ?? []).map((pool, pi) => (
                      <li
                        key={pi}
                        className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm"
                      >
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
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs text-zinc-600">
                            Teams
                            <input
                              type="number"
                              min={1}
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
                              className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5"
                              value={pool.teamsAdvancing}
                              onChange={(e) => updatePool(di, pi, { teamsAdvancing: e.target.value })}
                            />
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
                    onClick={() => addPool(di)}
                  >
                    + Add pool
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-2 text-sm text-zinc-700">
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
              <div className="border-t border-zinc-100 pt-2">
                <strong className="text-zinc-900">Structure</strong>
                <ul className="mt-1 list-inside list-disc space-y-1 text-zinc-600">
                  {divisionNames.map((dn, di) => (
                    <li key={di}>
                      {dn}: {(poolsByDivision[di] ?? [])
                        .map((p) => `${p.name} (${p.teamCount} teams, ${p.teamsAdvancing} adv.)`)
                        .join("; ")}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-zinc-500">
                Creates published tournament, HQ location, one field placeholder, divisions, pools, and
                placeholder teams. Slug is generated from the tournament name.
              </p>
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
