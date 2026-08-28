"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createTournamentFromWizard } from "@/app/admin/_actions/tournament-wizard";
import { BracketFormatExplainer } from "@/components/admin/tournament/BracketFormatExplainer";
import {
  explainerForFormatPreset,
  isObaDePresetKey,
  wizardFormatOptionsForTeamCount,
  type BracketFormatPresetKey,
} from "@/lib/brackets/oba-de-presets";
import {
  nextPowerOfTwoAtLeast,
  WIZARD_DEFAULT_TEAMS_EXTRA_DIVISION,
  WIZARD_DEFAULT_TEAMS_PER_DIVISION,
  WIZARD_MAX_DIVISIONS,
  WIZARD_MAX_POOLS_PER_DIVISION,
  WIZARD_MAX_TEAMS_PER_DIVISION,
  WIZARD_MAX_TEAMS_TOURNAMENT,
} from "@/lib/validations/tournament-wizard";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

type Format = "round_robin" | "bracket_only";
type SeedMode = "auto" | "manual";

function deriveBracketFormat(preset: BracketFormatPresetKey): "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" {
  if (preset === "single_elim_classic") return "SINGLE_ELIMINATION";
  return "DOUBLE_ELIMINATION";
}

function deriveBuildMode(preset: BracketFormatPresetKey): "template" | "custom" {
  return preset === "custom" ? "custom" : "template";
}

function defaultPresetForTeamCount(n: number): BracketFormatPresetKey {
  if (n === 4) return "oba_de_4";
  if (n === 5) return "oba_de_5";
  if (n === 6) return "oba_de_6";
  if (n === 7) return "oba_de_7";
  if (n === 13) return "oba_de_13";
  return "double_elim_classic";
}
type Step =
  | "basics"
  | "tourney_format"
  | "rr_pools"
  | "rr_assign"
  | "br_config"
  | "br_seed"
  | "creating"
  | "done";

type Props = { onClose: () => void };

/** Stable client key — never use display name for placement maps. */
function teamKey(di: number, ti: number): string {
  return `d${di}:t${ti}`;
}

function parseTeamKey(key: string): { di: number; ti: number } | null {
  const m = /^d(\d+):t(\d+)$/.exec(key);
  if (!m) return null;
  return { di: Number(m[1]), ti: Number(m[2]) };
}

function fillNames(count: number, raw: string[], skip: boolean, prefix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    if (skip) out.push(`${prefix}${i + 1}`);
    else out.push((raw[i] ?? "").trim() || `${prefix}${i + 1}`);
  }
  return out;
}

function teamsForDivision(
  divisionName: string,
  count: number,
  rawNames: string[],
  skipNaming: boolean,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    if (skipNaming) out.push(`${divisionName} · Team ${i + 1}`);
    else {
      const n = (rawNames[i] ?? "").trim();
      out.push(n || `${divisionName} · Team ${i + 1}`);
    }
  }
  return out;
}

export function CreateTournamentWizardModal({ onClose }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("basics");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [doneNextPath, setDoneNextPath] = useState("/admin/structure");

  const [tournamentName, setTournamentName] = useState("");
  const [format, setFormat] = useState<Format>("round_robin");
  const [divisionCount, setDivisionCount] = useState(1);
  const [skipDivisionNames, setSkipDivisionNames] = useState(false);
  const [divisionNameDrafts, setDivisionNameDrafts] = useState<string[]>([""]);
  const [teamsPerDivision, setTeamsPerDivision] = useState<number[]>([
    WIZARD_DEFAULT_TEAMS_PER_DIVISION,
  ]);
  const [skipTeamNames, setSkipTeamNames] = useState(false);
  const [teamNameDraftsByDiv, setTeamNameDraftsByDiv] = useState<string[][]>([
    Array(WIZARD_DEFAULT_TEAMS_PER_DIVISION).fill(""),
  ]);

  const [poolCounts, setPoolCounts] = useState<number[]>([2]);
  const [teamPlacement, setTeamPlacement] = useState<
    Record<string, { poolIndex: number } | "unassigned">
  >({});
  const [dragKey, setDragKey] = useState<string | null>(null);

  const [formatPresetByDiv, setFormatPresetByDiv] = useState<BracketFormatPresetKey[]>([
    "double_elim_classic",
  ]);
  const [seedMode, setSeedMode] = useState<SeedMode>("auto");
  const [entrySizeByDiv, setEntrySizeByDiv] = useState<number[]>([8]);
  const [manualSeedsByDiv, setManualSeedsByDiv] = useState<Array<Array<string | null>>>([[]]);

  const anyCustomPreset = formatPresetByDiv.some((p) => p === "custom");
  const anyClassicTemplate = formatPresetByDiv.some(
    (p) => p === "single_elim_classic" || p === "double_elim_classic",
  );
  const anyObaPreset = formatPresetByDiv.some((p) => isObaDePresetKey(p));

  const divisionNames = useMemo(
    () => fillNames(divisionCount, divisionNameDrafts, skipDivisionNames, "Division"),
    [divisionCount, divisionNameDrafts, skipDivisionNames],
  );

  const teamsByDivision = useMemo(
    () =>
      divisionNames.map((divName, di) =>
        teamsForDivision(
          divName,
          teamsPerDivision[di] ?? 0,
          teamNameDraftsByDiv[di] ?? [],
          skipTeamNames,
        ),
      ),
    [divisionNames, teamsPerDivision, teamNameDraftsByDiv, skipTeamNames],
  );

  const teamCount = useMemo(
    () => teamsByDivision.reduce((sum, row) => sum + row.length, 0),
    [teamsByDivision],
  );

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusable = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending && step !== "creating") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending, step]);

  function syncDivisionCount(n: number) {
    const count = Math.min(WIZARD_MAX_DIVISIONS, Math.max(1, n));
    setDivisionCount(count);
    setDivisionNameDrafts((prev) => {
      const next = [...prev];
      while (next.length < count) next.push("");
      return next.slice(0, count);
    });
    setPoolCounts((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(2);
      return next.slice(0, count);
    });
    setEntrySizeByDiv((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(8);
      return next.slice(0, count);
    });
    setFormatPresetByDiv((prev) => {
      const next = [...prev];
      while (next.length < count) next.push("double_elim_classic");
      return next.slice(0, count);
    });
    setTeamsPerDivision((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(WIZARD_DEFAULT_TEAMS_EXTRA_DIVISION);
      return next.slice(0, count);
    });
    setTeamNameDraftsByDiv((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push(Array(WIZARD_DEFAULT_TEAMS_EXTRA_DIVISION).fill(""));
      }
      return next.slice(0, count);
    });
  }

  function setDivisionTeamCount(di: number, n: number) {
    const count = Math.min(WIZARD_MAX_TEAMS_PER_DIVISION, Math.max(0, n));
    setTeamsPerDivision((prev) => {
      const next = [...prev];
      next[di] = count;
      return next;
    });
    setTeamNameDraftsByDiv((prev) => {
      const next = prev.map((row) => [...row]);
      const row = [...(next[di] ?? [])];
      while (row.length < count) row.push("");
      next[di] = row.slice(0, count);
      return next;
    });
    setFormatPresetByDiv((prev) => {
      const next = [...prev];
      const cur = next[di] ?? "double_elim_classic";
      if (isObaDePresetKey(cur)) {
        const need = Number(cur.replace("oba_de_", ""));
        if (need !== count) next[di] = defaultPresetForTeamCount(count);
      }
      return next;
    });
    setEntrySizeByDiv((prev) => {
      const next = [...prev];
      next[di] = nextPowerOfTwoAtLeast(Math.max(2, count));
      return next;
    });
  }

  function initRrAssign(preserve: boolean) {
    setTeamPlacement((prev) => {
      const next: Record<string, { poolIndex: number } | "unassigned"> = {};
      for (let di = 0; di < divisionCount; di++) {
        const count = teamsPerDivision[di] ?? 0;
        const pools = poolCounts[di] ?? 1;
        for (let ti = 0; ti < count; ti++) {
          const key = teamKey(di, ti);
          const prior = prev[key];
          if (
            preserve &&
            prior &&
            prior !== "unassigned" &&
            prior.poolIndex >= 0 &&
            prior.poolIndex < pools
          ) {
            next[key] = prior;
          } else {
            next[key] = "unassigned";
          }
        }
      }
      return next;
    });
  }

  function distributeEvenly() {
    setTeamPlacement((prev) => {
      const next = { ...prev };
      for (let di = 0; di < divisionCount; di++) {
        const count = teamsPerDivision[di] ?? 0;
        const pools = poolCounts[di] ?? 1;
        for (let ti = 0; ti < count; ti++) {
          next[teamKey(di, ti)] = { poolIndex: ti % pools };
        }
      }
      return next;
    });
  }

  function initBracketSeeds() {
    const sizes = teamsByDivision.map((teams) => nextPowerOfTwoAtLeast(Math.max(2, teams.length)));
    setEntrySizeByDiv(sizes);
    setManualSeedsByDiv(
      teamsByDivision.map((teams, di) => {
        const size = sizes[di]!;
        const order: Array<string | null> = [...teams];
        while (order.length < size) order.push(null);
        return order.slice(0, size);
      }),
    );
  }

  function goNextFromBasics() {
    setError(null);
    if (!tournamentName.trim()) {
      setError("Tournament name is required.");
      return;
    }
    if (teamCount < 2) {
      setError("Add at least 2 teams across your divisions.");
      return;
    }
    for (let di = 0; di < divisionCount; di++) {
      if ((teamsPerDivision[di] ?? 0) < 1) {
        setError(`Give ${divisionNames[di]} at least one team (or remove the division).`);
        return;
      }
      const names = teamsByDivision[di] ?? [];
      if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
        setError(`${divisionNames[di]}: team names must be unique within the division.`);
        return;
      }
    }
    if (teamCount > WIZARD_MAX_TEAMS_TOURNAMENT) {
      setError(`At most ${WIZARD_MAX_TEAMS_TOURNAMENT} teams total.`);
      return;
    }
    setStep("tourney_format");
  }

  function goNextFromTourneyFormat() {
    setError(null);
    if (format === "round_robin") {
      setStep("rr_pools");
      return;
    }
    setFormatPresetByDiv((prev) =>
      teamsByDivision.map((teams, di) => {
        const fallback = defaultPresetForTeamCount(teams.length);
        const cur = prev[di] ?? fallback;
        const options = wizardFormatOptionsForTeamCount(teams.length);
        return options.some((o) => o.key === cur) ? cur : fallback;
      }),
    );
    initBracketSeeds();
    setStep("br_config");
  }

  function poolLabel(_di: number, pi: number) {
    return `Pool ${String.fromCharCode(65 + pi)}`;
  }

  function finishNavigate(slug: string, nextPath: string) {
    window.location.assign(
      `/admin/select/${encodeURIComponent(slug)}?next=${encodeURIComponent(nextPath)}`,
    );
  }

  function validateManualSeeds(): string | null {
    for (let di = 0; di < divisionCount; di++) {
      const teams = teamsByDivision[di] ?? [];
      const size = entrySizeByDiv[di] ?? nextPowerOfTwoAtLeast(teams.length);
      const order = (manualSeedsByDiv[di] ?? []).slice(0, size);
      const placed = order.filter((x): x is string => x != null && x !== "");
      if (new Set(placed).size !== placed.length) {
        return `${divisionNames[di]}: each team can only appear once in Round 1 seeds.`;
      }
      const missing = teams.filter((t) => !placed.includes(t));
      if (missing.length > 0) {
        return `${divisionNames[di]}: ${missing.length} team(s) are not in any seed slot, so they would be left out of the bracket. Put every team in a seed (use “Fill seeds 1…n” for classic byes), or switch to Automatic.`;
      }
    }
    return null;
  }

  async function submit() {
    setPending(true);
    setError(null);
    setWarnings([]);
    setNotes([]);
    setStep("creating");
    try {
      let payload: unknown;
      if (format === "round_robin") {
        const rrDivisions = divisionNames.map((name, di) => {
          const count = poolCounts[di] ?? 1;
          const divTeams = teamsByDivision[di] ?? [];
          const pools = Array.from({ length: count }, (_, pi) => ({
            name: poolLabel(di, pi),
            teamNames: divTeams.filter((_, ti) => {
              const p = teamPlacement[teamKey(di, ti)];
              return p !== "unassigned" && p && p.poolIndex === pi;
            }),
            teamsAdvancing: 0,
          })).filter((p) => p.teamNames.length > 0);
          return { name, pools };
        });
        const unassignedKeys = Object.entries(teamPlacement).filter(([, v]) => v === "unassigned");
        if (unassignedKeys.length > 0) {
          setError(`Place all teams into pools (${unassignedKeys.length} still unassigned).`);
          setPending(false);
          setStep("rr_assign");
          return;
        }
        for (const d of rrDivisions) {
          if (d.pools.length === 0) {
            setError(`${d.name}: place teams into at least one pool.`);
            setPending(false);
            setStep("rr_assign");
            return;
          }
        }
        const flatNames = teamsByDivision.flat();
        payload = {
          tournamentName: tournamentName.trim(),
          format: "round_robin",
          divisions: { count: divisionCount, names: divisionNames, skipNaming: skipDivisionNames },
          teams: { count: teamCount, names: flatNames, skipNaming: skipTeamNames },
          roundRobin: { divisions: rrDivisions },
        };
      } else {
        for (let di = 0; di < divisionCount; di++) {
          if ((teamsByDivision[di] ?? []).length < 2) {
            setError(`${divisionNames[di]} needs at least 2 teams for a bracket.`);
            setPending(false);
            setStep("br_config");
            return;
          }
        }
        if (anyClassicTemplate && seedMode === "manual") {
          const seedErr = validateManualSeeds();
          if (seedErr) {
            setError(seedErr);
            setPending(false);
            setStep("br_seed");
            return;
          }
        }
        const bracketDivisions = divisionNames.map((name, di) => {
          const teams = teamsByDivision[di] ?? [];
          const formatPreset = formatPresetByDiv[di] ?? "double_elim_classic";
          const buildMode = deriveBuildMode(formatPreset);
          const bracketFormat = deriveBracketFormat(formatPreset);
          const entrySize = isObaDePresetKey(formatPreset)
            ? teams.length
            : (entrySizeByDiv[di] ?? nextPowerOfTwoAtLeast(teams.length));
          const classicManual =
            seedMode === "manual" &&
            (formatPreset === "single_elim_classic" || formatPreset === "double_elim_classic");
          return {
            name,
            teamNames: teams,
            formatPreset,
            bracketFormat,
            buildMode,
            entrySize: Math.max(2, entrySize),
            seedMode: buildMode === "custom" || isObaDePresetKey(formatPreset) ? "auto" : seedMode,
            firstRoundOrder: classicManual
              ? (manualSeedsByDiv[di] ?? []).slice(0, entrySize)
              : undefined,
          };
        });
        payload = {
          tournamentName: tournamentName.trim(),
          format: "bracket_only",
          divisions: { count: divisionCount, names: divisionNames, skipNaming: skipDivisionNames },
          teams: { count: teamCount, names: teamsByDivision.flat(), skipNaming: skipTeamNames },
          bracket: { divisions: bracketDivisions },
        };
      }

      const result = await createTournamentFromWizard(payload);
      if (!result.ok) {
        setError(result.error);
        setNotes(result.finishNotes ?? []);
        setPending(false);
        if (result.slug) {
          setCreatedSlug(result.slug);
          setDoneNextPath("/admin/structure");
          setStep("done");
        } else {
          setStep(
            format === "round_robin"
              ? "rr_assign"
              : anyCustomPreset || anyObaPreset
                ? "br_config"
                : "br_seed",
          );
        }
        return;
      }

      setNotes(result.finishNotes);
      setWarnings(result.warnings);
      setCreatedSlug(result.slug);
      setDoneNextPath(result.nextPath);
      setPending(false);
      if (result.warnings.length > 0) {
        setStep("done");
        return;
      }
      onClose();
      finishNavigate(result.slug, result.nextPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tournament");
      setPending(false);
      setStep("basics");
    }
  }

  const stepTitle =
    step === "basics"
      ? "Step 1 — teams"
      : step === "tourney_format"
        ? "Step 2 — tournament format"
        : step === "rr_pools"
          ? "Step 3 — pools"
          : step === "rr_assign"
            ? "Step 4 — place teams"
            : step === "br_config"
              ? "Step 3 — bracket format"
              : step === "br_seed"
                ? "Step 4 — seed Round 1"
                : step === "done"
                  ? "Created"
                  : "Creating…";

  const dismissDisabled = pending || step === "creating";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog backdrop"
        disabled={dismissDisabled}
        onClick={() => {
          if (!dismissDisabled) onClose();
        }}
      />
      <div
        ref={dialogRef}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
              Create tournament
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{stepTitle}</p>
          </div>
          <button
            type="button"
            disabled={dismissDisabled}
            onClick={onClose}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="mb-4 list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-950">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {notes.length > 0 && step === "done" ? (
            <ul className="mb-4 list-disc space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-2 text-sm text-zinc-700">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}

          {step === "basics" ? (
            <div className="flex flex-col gap-5">
              <div>
                <label className={labelClass}>Tournament name</label>
                <input
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Spring Classic 2026"
                  className={`${formClass} mt-1 w-full`}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelClass}>Number of divisions</label>
                <input
                  type="number"
                  min={1}
                  max={WIZARD_MAX_DIVISIONS}
                  value={divisionCount}
                  onChange={(e) => syncDivisionCount(Number(e.target.value) || 1)}
                  className={`${formClass} mt-1 w-32`}
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={labelClass}>Division names</p>
                  <label className="flex items-center gap-2 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={skipDivisionNames}
                      onChange={(e) => setSkipDivisionNames(e.target.checked)}
                    />
                    Use Division1, Division2…
                  </label>
                </div>
                {!skipDivisionNames ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {Array.from({ length: divisionCount }, (_, i) => (
                      <input
                        key={i}
                        value={divisionNameDrafts[i] ?? ""}
                        onChange={(e) => {
                          const next = [...divisionNameDrafts];
                          next[i] = e.target.value;
                          setDivisionNameDrafts(next);
                        }}
                        placeholder={`Division ${i + 1}`}
                        className={`${formClass} w-full`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">{divisionNames.join(", ")}</p>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={labelClass}>Teams per division</p>
                  <label className="flex items-center gap-2 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={skipTeamNames}
                      onChange={(e) => setSkipTeamNames(e.target.checked)}
                    />
                    Use placeholders (Division · Team N)
                  </label>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Set the team count first — OBA maps (4–7 or 13 teams) only show after this step.
                  Each division can have a different count. Total:{" "}
                  <span className="font-medium text-zinc-700">{teamCount}</span>
                </p>
                <div className="mt-3 flex flex-col gap-4">
                  {divisionNames.map((divName, di) => {
                    const count = teamsPerDivision[di] ?? 0;
                    const drafts = teamNameDraftsByDiv[di] ?? [];
                    return (
                      <div key={di} className="rounded-lg border border-zinc-200 p-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-[120px] flex-1">
                            <p className="text-sm font-medium text-zinc-900">{divName}</p>
                          </div>
                          <div>
                            <label className={labelClass}>Teams</label>
                            <input
                              type="number"
                              min={1}
                              max={WIZARD_MAX_TEAMS_PER_DIVISION}
                              value={count}
                              onChange={(e) => setDivisionTeamCount(di, Number(e.target.value) || 0)}
                              className={`${formClass} mt-1 w-20`}
                            />
                          </div>
                        </div>
                        {!skipTeamNames ? (
                          <textarea
                            value={drafts.join("\n")}
                            onChange={(e) => {
                              const lines = e.target.value.split(/\r?\n/);
                              setTeamNameDraftsByDiv((prev) => {
                                const next = prev.map((row) => [...row]);
                                next[di] = Array.from({ length: count }, (_, i) => lines[i] ?? "");
                                return next;
                              });
                            }}
                            rows={Math.min(8, Math.max(3, count))}
                            placeholder={`One team per line for ${divName}`}
                            className={`${formClass} mt-2 w-full font-mono text-xs`}
                          />
                        ) : (
                          <p className="mt-2 text-xs text-zinc-500">
                            {(teamsByDivision[di] ?? []).slice(0, 6).join(", ")}
                            {(teamsByDivision[di] ?? []).length > 6
                              ? ` … (+${(teamsByDivision[di] ?? []).length - 6} more)`
                              : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Creates a draft (not public). Venue, dates, and schedule are set in tournament settings.
                </p>
              </div>
            </div>
          ) : null}

          {step === "tourney_format" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-600">
                {teamCount} team{teamCount === 1 ? "" : "s"} across {divisionCount} division
                {divisionCount === 1 ? "" : "s"}. How should this tournament run?
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-800 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={format === "round_robin"}
                    onChange={() => setFormat("round_robin")}
                  />
                  <span>
                    <span className="font-medium">Round robin, then bracket</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Pool play first. You’ll set pools next; the playoff bracket is built later
                      under Admin → Brackets.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-800 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={format === "bracket_only"}
                    onChange={() => setFormat("bracket_only")}
                  />
                  <span>
                    <span className="font-medium">Bracket only</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Skip pool play — choose a single- or double-elimination map next.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          {step === "rr_pools" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-600">
                How many pools in each division? You can use different counts per division.
              </p>
              {divisionNames.map((name, di) => (
                <div key={di} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-3">
                  <div className="min-w-[140px] flex-1">
                    <p className="text-sm font-medium text-zinc-900">{name}</p>
                  </div>
                  <div>
                    <label className={labelClass}>Pools</label>
                    <input
                      type="number"
                      min={1}
                      max={WIZARD_MAX_POOLS_PER_DIVISION}
                      value={poolCounts[di] ?? 1}
                      onChange={(e) => {
                        const next = [...poolCounts];
                        next[di] = Math.min(
                          WIZARD_MAX_POOLS_PER_DIVISION,
                          Math.max(1, Number(e.target.value) || 1),
                        );
                        setPoolCounts(next);
                      }}
                      className={`${formClass} mt-1 w-20`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step === "rr_assign" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-zinc-600">
                  Drag or tap teams into pools. Teams stay in their own division.
                </p>
                <button type="button" className={btnSecondary} onClick={distributeEvenly}>
                  Distribute evenly
                </button>
              </div>
              {divisionNames.map((divName, di) => {
                const divTeams = teamsByDivision[di] ?? [];
                return (
                  <div key={di} className="rounded-lg border border-zinc-200 p-3">
                    <p className="text-sm font-semibold text-zinc-900">{divName}</p>
                    <div className="mt-3 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-2">
                      <p className={labelClass}>Unassigned</p>
                      <div className="mt-2 flex min-h-[40px] flex-wrap gap-2">
                        {divTeams.map((name, ti) => {
                          const key = teamKey(di, ti);
                          if (teamPlacement[key] !== "unassigned") return null;
                          return (
                            <button
                              key={key}
                              type="button"
                              draggable
                              onDragStart={() => setDragKey(key)}
                              onDragEnd={() => setDragKey(null)}
                              onClick={() => {
                                // Tap-to-cycle into first pool for touch devices
                                setTeamPlacement((prev) => ({
                                  ...prev,
                                  [key]: { poolIndex: 0 },
                                }));
                              }}
                              className="cursor-grab rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 active:cursor-grabbing"
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: poolCounts[di] ?? 1 }, (_, pi) => (
                        <div
                          key={pi}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!dragKey) return;
                            const parsed = parseTeamKey(dragKey);
                            if (!parsed || parsed.di !== di) return;
                            setTeamPlacement((prev) => ({
                              ...prev,
                              [dragKey]: { poolIndex: pi },
                            }));
                            setDragKey(null);
                          }}
                          className="min-h-[88px] rounded-md border border-zinc-200 bg-zinc-50/80 p-2"
                        >
                          <p className={labelClass}>{poolLabel(di, pi)}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {divTeams.map((name, ti) => {
                              const key = teamKey(di, ti);
                              const p = teamPlacement[key];
                              if (p === "unassigned" || !p || p.poolIndex !== pi) return null;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  draggable
                                  onDragStart={() => setDragKey(key)}
                                  onDragEnd={() => setDragKey(null)}
                                  onClick={() =>
                                    setTeamPlacement((prev) => ({ ...prev, [key]: "unassigned" }))
                                  }
                                  className="cursor-grab rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900"
                                  title="Click to unassign · drag to move"
                                >
                                  {name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {step === "br_config" ? (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-zinc-600">
                Choose a bracket format per division. OBA double-elimination maps (4–7 and 13 teams)
                appear when that division’s team count matches.
              </p>
              {divisionNames.map((name, di) => {
                const teams = teamsByDivision[di] ?? [];
                const preset = formatPresetByDiv[di] ?? defaultPresetForTeamCount(teams.length);
                const options = wizardFormatOptionsForTeamCount(teams.length);
                const suggested = nextPowerOfTwoAtLeast(Math.max(2, teams.length));
                const showClassicSize =
                  preset === "single_elim_classic" || preset === "double_elim_classic";
                return (
                  <div key={di} className="rounded-lg border border-zinc-200 p-3">
                    <p className="text-sm font-medium text-zinc-900">
                      {name}{" "}
                      <span className="font-normal text-zinc-500">({teams.length} teams)</span>
                    </p>
                    <label className={`${labelClass} mt-2 block`}>Bracket format</label>
                    <select
                      value={options.some((o) => o.key === preset) ? preset : (options[0]?.key ?? "custom")}
                      onChange={(e) => {
                        const next = [...formatPresetByDiv];
                        next[di] = e.target.value as BracketFormatPresetKey;
                        setFormatPresetByDiv(next);
                      }}
                      className={`${formClass} mt-1`}
                    >
                      {options.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {showClassicSize ? (
                      <>
                        <label className={`${labelClass} mt-3 block`}>Bracket size (slots)</label>
                        <select
                          value={entrySizeByDiv[di] ?? suggested}
                          onChange={(e) => {
                            const next = [...entrySizeByDiv];
                            next[di] = Number(e.target.value);
                            setEntrySizeByDiv(next);
                          }}
                          className={`${formClass} mt-1`}
                        >
                          {[2, 4, 8, 16, 32, 64]
                            .filter((n) => n >= teams.length || n === suggested)
                            .map((n) => (
                              <option key={n} value={n}>
                                {n} slots
                              </option>
                            ))}
                        </select>
                      </>
                    ) : null}
                    {preset === "oba_de_4" || preset === "oba_de_13" ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Team list order is the draw order (first drawn = Team 1 bye). Remaining
                        teams pair in list order into Round 1.
                      </p>
                    ) : preset === "oba_de_5" ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Team list order is seed order (first = seed 1 / strongest). For 5 teams, seeds
                        1–3 get Round 1 byes; seed 4 plays seed 5.
                      </p>
                    ) : isObaDePresetKey(preset) ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Team list order is seed order (first = seed 1 / strongest). Top seeds receive
                        Round 1 byes.
                      </p>
                    ) : null}
                    <BracketFormatExplainer sections={explainerForFormatPreset(preset)} />
                  </div>
                );
              })}
            </div>
          ) : null}

          {step === "br_seed" ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className={labelClass}>Place teams in Round 1</p>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={seedMode === "auto"}
                      onChange={() => setSeedMode("auto")}
                    />
                    <span>
                      <span className="font-medium">Automatic</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Seed in list order with classic placement and BYEs as needed.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={seedMode === "manual"}
                      onChange={() => setSeedMode("manual")}
                    />
                    <span>
                      <span className="font-medium">Place manually</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Put every team in a seed slot (1 = strongest). Empty slots pad the field —
                        they are not “this seed sits out.” Higher seeds get the walkovers.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              {seedMode === "manual" ? (
                divisionNames.map((name, di) => {
                  const size = entrySizeByDiv[di] ?? 8;
                  const teams = teamsByDivision[di] ?? [];
                  const order = manualSeedsByDiv[di] ?? Array(size).fill(null);
                  return (
                    <div key={di} className="rounded-lg border border-zinc-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900">{name}</p>
                        <button
                          type="button"
                          className="text-xs font-medium text-emerald-800 underline"
                          onClick={() => {
                            const nextAll = manualSeedsByDiv.map((row) => [...row]);
                            const row: Array<string | null> = [...teams];
                            while (row.length < size) row.push(null);
                            nextAll[di] = row.slice(0, size);
                            setManualSeedsByDiv(nextAll);
                          }}
                        >
                          Fill seeds 1…{teams.length} (classic byes)
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        Example for {teams.length} teams in a {size}-slot field: place all {teams.length}{" "}
                        teams in seeds 1–{teams.length}, leave {size - teams.length} empty. Classic
                        pairing gives top seeds the first-round byes.
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {Array.from({ length: size }, (_, si) => (
                          <div key={si}>
                            <label className={labelClass}>Seed {si + 1}</label>
                            <select
                              value={order[si] ?? ""}
                              onChange={(e) => {
                                const nextAll = manualSeedsByDiv.map((row) => [...row]);
                                const row = [...(nextAll[di] ?? Array(size).fill(null))];
                                while (row.length < size) row.push(null);
                                row[si] = e.target.value || null;
                                nextAll[di] = row;
                                setManualSeedsByDiv(nextAll);
                              }}
                              className={`${formClass} mt-1 w-full`}
                            >
                              <option value="">BYE</option>
                              {teams.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-600">
                  Each division keeps its own team list and is seeded automatically.
                </p>
              )}
            </div>
          ) : null}

          {step === "creating" ? (
            <p className="text-sm text-zinc-600">{pending ? "Creating your tournament…" : "Almost done…"}</p>
          ) : null}

          {step === "done" && createdSlug ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-zinc-700">
                {error
                  ? "The tournament was saved, but something still needs attention. Continue to admin to finish setup."
                  : "Tournament created. Review the notes above, then continue."}
              </p>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => finishNavigate(createdSlug, doneNextPath)}
              >
                Continue to admin →
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            className={btnSecondary}
            disabled={pending || step === "done"}
            onClick={() => {
              setError(null);
              if (step === "basics") onClose();
              else if (step === "tourney_format") setStep("basics");
              else if (step === "rr_pools" || step === "br_config") setStep("tourney_format");
              else if (step === "rr_assign") setStep("rr_pools");
              else if (step === "br_seed") setStep("br_config");
            }}
          >
            {step === "basics" ? "Cancel" : "Back"}
          </button>
          {step === "basics" ? (
            <button type="button" className={btnPrimary} onClick={goNextFromBasics}>
              Next
            </button>
          ) : null}
          {step === "tourney_format" ? (
            <button type="button" className={btnPrimary} onClick={goNextFromTourneyFormat}>
              Next
            </button>
          ) : null}
          {step === "rr_pools" ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                initRrAssign(true);
                setStep("rr_assign");
              }}
            >
              Next
            </button>
          ) : null}
          {step === "rr_assign" ? (
            <button type="button" className={btnPrimary} disabled={pending} onClick={() => void submit()}>
              Create tournament
            </button>
          ) : null}
          {step === "br_config" ? (
            <button
              type="button"
              className={btnPrimary}
              disabled={pending}
              onClick={() => {
                if (anyCustomPreset && !anyClassicTemplate && !anyObaPreset) {
                  setSeedMode("auto");
                  void submit();
                  return;
                }
                // OBA presets use list order as the draw — skip classic seed board.
                if (!anyClassicTemplate) {
                  setSeedMode("auto");
                  void submit();
                  return;
                }
                initBracketSeeds();
                setStep("br_seed");
              }}
            >
              {anyCustomPreset && !anyClassicTemplate && !anyObaPreset
                ? "Create & open structure"
                : !anyClassicTemplate
                  ? "Create tournament"
                  : "Next"}
            </button>
          ) : null}
          {step === "br_seed" ? (
            <button type="button" className={btnPrimary} disabled={pending} onClick={() => void submit()}>
              Create tournament
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
