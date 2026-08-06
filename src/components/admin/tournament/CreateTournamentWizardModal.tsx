"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createTournamentFromWizard } from "@/app/admin/_actions/tournament-wizard";
import {
  nextPowerOfTwoAtLeast,
  WIZARD_MAX_DIVISIONS,
  WIZARD_MAX_POOLS_PER_DIVISION,
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
type BracketFormat = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION";
type BuildMode = "template" | "custom";
type SeedMode = "auto" | "manual";

type Step =
  | "basics"
  | "rr_pools"
  | "rr_assign"
  | "br_config"
  | "br_seed"
  | "creating";

type Props = { onClose: () => void };

function fillNames(count: number, raw: string[], skip: boolean, prefix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    if (skip) out.push(`${prefix}${i + 1}`);
    else out.push((raw[i] ?? "").trim() || `${prefix}${i + 1}`);
  }
  return out;
}

function evenlySplit<T>(items: T[], buckets: number): T[][] {
  const n = Math.max(1, buckets);
  const out: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => {
    out[i % n]!.push(item);
  });
  return out;
}

export function CreateTournamentWizardModal({ onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Modal 1
  const [tournamentName, setTournamentName] = useState("");
  const [format, setFormat] = useState<Format>("round_robin");
  const [divisionCount, setDivisionCount] = useState(1);
  const [skipDivisionNames, setSkipDivisionNames] = useState(false);
  const [divisionNameDrafts, setDivisionNameDrafts] = useState<string[]>(["Division1"]);
  const [teamCount, setTeamCount] = useState(8);
  const [skipTeamNames, setSkipTeamNames] = useState(false);
  const [teamNameDrafts, setTeamNameDrafts] = useState<string[]>(Array(8).fill(""));

  // 2A
  const [poolCounts, setPoolCounts] = useState<number[]>([2]);
  /** poolIndex by teamName (within active division view we use global map: divisionIndex:poolIndex or unassigned) */
  const [teamPlacement, setTeamPlacement] = useState<
    Record<string, { divisionIndex: number; poolIndex: number } | "unassigned">
  >({});
  const [dragTeam, setDragTeam] = useState<string | null>(null);

  // 2B
  const [bracketFormat, setBracketFormat] = useState<BracketFormat>("SINGLE_ELIMINATION");
  const [buildMode, setBuildMode] = useState<BuildMode>("template");
  const [seedMode, setSeedMode] = useState<SeedMode>("auto");
  const [entrySizeByDiv, setEntrySizeByDiv] = useState<number[]>([8]);
  const [manualSeedsByDiv, setManualSeedsByDiv] = useState<Array<Array<string | null>>>([[]]);

  const divisionNames = useMemo(
    () => fillNames(divisionCount, divisionNameDrafts, skipDivisionNames, "Division"),
    [divisionCount, divisionNameDrafts, skipDivisionNames],
  );
  const teamNames = useMemo(
    () => fillNames(teamCount, teamNameDrafts, skipTeamNames, "Team"),
    [teamCount, teamNameDrafts, skipTeamNames],
  );

  const teamsByDivision = useMemo(() => evenlySplit(teamNames, divisionCount), [teamNames, divisionCount]);

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
  }

  function syncTeamCount(n: number) {
    const count = Math.min(WIZARD_MAX_TEAMS_TOURNAMENT, Math.max(2, n));
    setTeamCount(count);
    setTeamNameDrafts((prev) => {
      const next = [...prev];
      while (next.length < count) next.push("");
      return next.slice(0, count);
    });
  }

  function initRrAssign() {
    const placement: Record<string, { divisionIndex: number; poolIndex: number } | "unassigned"> = {};
    for (const name of teamNames) placement[name] = "unassigned";
    setTeamPlacement(placement);
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
      setError("Add at least 2 teams.");
      return;
    }
    if (format === "round_robin") {
      setStep("rr_pools");
    } else {
      initBracketSeeds();
      setStep("br_config");
    }
  }

  function poolLabel(di: number, pi: number) {
    return `Pool ${String.fromCharCode(65 + pi)}`;
  }

  async function submit() {
    setPending(true);
    setError(null);
    setStep("creating");
    try {
      let payload: unknown;
      if (format === "round_robin") {
        const rrDivisions = divisionNames.map((name, di) => {
          const count = poolCounts[di] ?? 1;
          const pools = Array.from({ length: count }, (_, pi) => ({
            name: poolLabel(di, pi),
            teamNames: teamNames.filter((t) => {
              const p = teamPlacement[t];
              return p !== "unassigned" && p && p.divisionIndex === di && p.poolIndex === pi;
            }),
            teamsAdvancing: 0,
          }));
          return { name, pools };
        });
        const unassigned = teamNames.filter((t) => teamPlacement[t] === "unassigned");
        if (unassigned.length > 0) {
          setError(`Place all teams into pools (${unassigned.length} still unassigned).`);
          setPending(false);
          setStep("rr_assign");
          return;
        }
        for (const d of rrDivisions) {
          if (d.pools.every((p) => p.teamNames.length === 0)) {
            setError(`Each division needs at least one team in a pool (${d.name}).`);
            setPending(false);
            setStep("rr_assign");
            return;
          }
        }
        payload = {
          tournamentName: tournamentName.trim(),
          format: "round_robin",
          divisions: { count: divisionCount, names: divisionNames, skipNaming: skipDivisionNames },
          teams: { count: teamCount, names: teamNames, skipNaming: skipTeamNames },
          roundRobin: { divisions: rrDivisions },
        };
      } else {
        const bracketDivisions = divisionNames.map((name, di) => {
          const teams = teamsByDivision[di] ?? [];
          const entrySize = entrySizeByDiv[di] ?? nextPowerOfTwoAtLeast(teams.length);
          return {
            name,
            teamNames: teams,
            bracketFormat,
            buildMode,
            entrySize,
            seedMode: buildMode === "custom" ? "auto" : seedMode,
            firstRoundOrder:
              seedMode === "manual" && buildMode === "template"
                ? (manualSeedsByDiv[di] ?? []).slice(0, entrySize)
                : undefined,
          };
        });
        payload = {
          tournamentName: tournamentName.trim(),
          format: "bracket_only",
          divisions: { count: divisionCount, names: divisionNames, skipNaming: skipDivisionNames },
          teams: { count: teamCount, names: teamNames, skipNaming: skipTeamNames },
          bracket: { divisions: bracketDivisions },
        };
      }

      const result = await createTournamentFromWizard(payload);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        setStep(format === "round_robin" ? "rr_assign" : "br_seed");
        return;
      }

      router.push(
        result.openCustomBuilder ? `/admin/structure?builder=1` : `/admin/structure`,
      );
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tournament");
      setPending(false);
      setStep("basics");
    }
  }

  const stepTitle =
    step === "basics"
      ? "Step 1 — basics"
      : step === "rr_pools"
        ? "Step 2 — pools"
        : step === "rr_assign"
          ? "Step 3 — place teams"
          : step === "br_config"
            ? "Step 2 — bracket setup"
            : step === "br_seed"
              ? "Step 3 — seed Round 1"
              : "Creating…";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="create-tourney-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 id="create-tourney-title" className="text-lg font-semibold text-zinc-900">
              Create tournament
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{stepTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
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
                <p className={labelClass}>Tournament format</p>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-start gap-2 text-sm text-zinc-800">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={format === "round_robin"}
                      onChange={() => setFormat("round_robin")}
                    />
                    <span>
                      <span className="font-medium">Round robin</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Pool play first. You’ll set pools and drag teams into them next.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-zinc-800">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={format === "bracket_only"}
                      onChange={() => setFormat("bracket_only")}
                    />
                    <span>
                      <span className="font-medium">Bracket only</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Skip pool play — build single or double elimination next.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Number of divisions</label>
                  <input
                    type="number"
                    min={1}
                    max={WIZARD_MAX_DIVISIONS}
                    value={divisionCount}
                    onChange={(e) => syncDivisionCount(Number(e.target.value) || 1)}
                    className={`${formClass} mt-1 w-full`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Number of teams</label>
                  <input
                    type="number"
                    min={2}
                    max={WIZARD_MAX_TEAMS_TOURNAMENT}
                    value={teamCount}
                    onChange={(e) => syncTeamCount(Number(e.target.value) || 2)}
                    className={`${formClass} mt-1 w-full`}
                  />
                </div>
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
                  <p className={labelClass}>Team names</p>
                  <label className="flex items-center gap-2 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={skipTeamNames}
                      onChange={(e) => setSkipTeamNames(e.target.checked)}
                    />
                    Use Team1, Team2…
                  </label>
                </div>
                {!skipTeamNames ? (
                  <textarea
                    value={teamNameDrafts.join("\n")}
                    onChange={(e) => {
                      const lines = e.target.value.split(/\r?\n/);
                      const next = Array.from({ length: teamCount }, (_, i) => lines[i] ?? "");
                      setTeamNameDrafts(next);
                    }}
                    rows={Math.min(12, Math.max(4, teamCount))}
                    placeholder={"One team per line\nRaptors\nThunder\n…"}
                    className={`${formClass} mt-2 w-full font-mono text-xs`}
                  />
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">
                    {teamNames.slice(0, 8).join(", ")}
                    {teamNames.length > 8 ? ` … (+${teamNames.length - 8} more)` : ""}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  Venue, dates, fields, and schedule windows are set later in tournament settings.
                </p>
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
              <p className="text-sm text-zinc-600">
                Drag teams from the bank into a pool. Every team must be placed.
              </p>
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
                <p className={labelClass}>Unassigned</p>
                <div className="mt-2 flex min-h-[48px] flex-wrap gap-2">
                  {teamNames
                    .filter((t) => teamPlacement[t] === "unassigned")
                    .map((t) => (
                      <button
                        key={t}
                        type="button"
                        draggable
                        onDragStart={() => setDragTeam(t)}
                        onDragEnd={() => setDragTeam(null)}
                        className="cursor-grab rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 active:cursor-grabbing"
                      >
                        {t}
                      </button>
                    ))}
                </div>
              </div>
              {divisionNames.map((divName, di) => (
                <div key={di} className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{divName}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: poolCounts[di] ?? 1 }, (_, pi) => (
                      <div
                        key={pi}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!dragTeam) return;
                          setTeamPlacement((prev) => ({
                            ...prev,
                            [dragTeam]: { divisionIndex: di, poolIndex: pi },
                          }));
                          setDragTeam(null);
                        }}
                        className="min-h-[88px] rounded-md border border-zinc-200 bg-zinc-50/80 p-2"
                      >
                        <p className={labelClass}>{poolLabel(di, pi)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {teamNames
                            .filter((t) => {
                              const p = teamPlacement[t];
                              return p !== "unassigned" && p && p.divisionIndex === di && p.poolIndex === pi;
                            })
                            .map((t) => (
                              <button
                                key={t}
                                type="button"
                                draggable
                                onDragStart={() => setDragTeam(t)}
                                onDragEnd={() => setDragTeam(null)}
                                onClick={() =>
                                  setTeamPlacement((prev) => ({ ...prev, [t]: "unassigned" }))
                                }
                                className="cursor-grab rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900"
                                title="Click to unassign"
                              >
                                {t}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {step === "br_config" ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className={labelClass}>Bracket format</p>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={bracketFormat === "SINGLE_ELIMINATION"}
                      onChange={() => setBracketFormat("SINGLE_ELIMINATION")}
                    />
                    Single elimination
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={bracketFormat === "DOUBLE_ELIMINATION"}
                      onChange={() => setBracketFormat("DOUBLE_ELIMINATION")}
                    />
                    Double elimination
                  </label>
                </div>
              </div>
              <div>
                <p className={labelClass}>How to build</p>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={buildMode === "template"}
                      onChange={() => setBuildMode("template")}
                    />
                    <span>
                      <span className="font-medium">Use a template</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Standard power-of-2 bracket sized to your teams (BYEs pad as needed).
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={buildMode === "custom"}
                      onChange={() => setBuildMode("custom")}
                    />
                    <span>
                      <span className="font-medium">Draw my own bracket</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Creates the tournament, then opens the structure page so you can refine the bracket.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              {buildMode === "template"
                ? divisionNames.map((name, di) => {
                    const teams = teamsByDivision[di] ?? [];
                    const suggested = nextPowerOfTwoAtLeast(Math.max(2, teams.length));
                    return (
                      <div key={di} className="rounded-lg border border-zinc-200 p-3">
                        <p className="text-sm font-medium text-zinc-900">
                          {name}{" "}
                          <span className="font-normal text-zinc-500">({teams.length} teams)</span>
                        </p>
                        <label className={`${labelClass} mt-2 block`}>Bracket size (slots)</label>
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
                      </div>
                    );
                  })
                : null}
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
                        Seed in list order with classic bracket placement and BYEs as needed.
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
                        Pick which team sits in each seed slot (empty = BYE).
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              {seedMode === "manual"
                ? divisionNames.map((name, di) => {
                    const size = entrySizeByDiv[di] ?? 8;
                    const teams = teamsByDivision[di] ?? [];
                    const order = manualSeedsByDiv[di] ?? Array(size).fill(null);
                    return (
                      <div key={di} className="rounded-lg border border-zinc-200 p-3">
                        <p className="text-sm font-medium text-zinc-900">{name}</p>
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
                : (
                  <p className="text-sm text-zinc-600">
                    Teams are split across divisions evenly, then seeded automatically.
                  </p>
                )}
            </div>
          ) : null}

          {step === "creating" ? (
            <p className="text-sm text-zinc-600">{pending ? "Creating your tournament…" : "Almost done…"}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            className={btnSecondary}
            disabled={pending}
            onClick={() => {
              setError(null);
              if (step === "basics") onClose();
              else if (step === "rr_pools" || step === "br_config") setStep("basics");
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
          {step === "rr_pools" ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                initRrAssign();
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
              onClick={() => {
                if (buildMode === "custom") {
                  setSeedMode("auto");
                  void submit();
                } else {
                  initBracketSeeds();
                  setStep("br_seed");
                }
              }}
            >
              {buildMode === "custom" ? "Create & open builder" : "Next"}
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
