"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BracketFormat } from "@prisma/client";
import {
  BracketSeedBoard,
  type SeedBoardMatch,
  type SeedBoardTeam,
} from "@/components/admin/structure/BracketSeedBoard";

type TeamRow = { id: string; name: string };
type PoolRow = { id: string; name: string; teams: TeamRow[] };
type BracketRow = {
  id: string;
  name: string;
  format: BracketFormat;
  published: boolean;
  avoidRematchesUntilForced: boolean;
  rounds: number;
  games: number;
};

export type StructureSeedBoard = {
  bracketId: string;
  bracketName: string;
  teams: SeedBoardTeam[];
  matches: SeedBoardMatch[];
  presetKey?: string | null;
};

type DivisionRow = {
  id: string;
  name: string;
  pools: PoolRow[];
  bracket: BracketRow | null;
  seedBoard: StructureSeedBoard | null;
};

function formatLabel(f: BracketFormat): string {
  if (f === "DOUBLE_ELIMINATION") return "Double elimination";
  if (f === "TRIPLE_ELIMINATION") return "Triple elimination";
  return "Single elimination";
}

export function StructureOverview({
  divisions,
  canConfigure,
  openBuilder = false,
}: {
  divisions: DivisionRow[];
  canConfigure: boolean;
  openBuilder?: boolean;
}) {
  const [tab, setTab] = useState(divisions[0]?.id ?? "");
  const active = useMemo(
    () => divisions.find((d) => d.id === tab) ?? divisions[0] ?? null,
    [divisions, tab],
  );

  if (divisions.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No divisions yet.{" "}
        {canConfigure ? (
          <Link href="/admin/divisions" className="font-medium text-emerald-700 underline">
            Add divisions
          </Link>
        ) : null}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        {divisions.map((d) => {
          const selected = (active?.id ?? "") === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setTab(d.id)}
              className={
                selected
                  ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
              }
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="flex flex-col gap-8">
          {active.seedBoard && (openBuilder || canConfigure) ? (
            <section>
              <BracketSeedBoard
                key={`${active.seedBoard.bracketId}-${active.id}`}
                bracketId={active.seedBoard.bracketId}
                bracketName={active.seedBoard.bracketName}
                teams={active.seedBoard.teams}
                matches={active.seedBoard.matches}
                presetKey={active.seedBoard.presetKey}
                canConfigure={canConfigure}
              />
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">Pools & teams</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.pools.map((p) => (
                <div key={p.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{p.name}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.teams.length === 0 ? (
                      <li className="text-sm text-zinc-500">No teams</li>
                    ) : (
                      p.teams.map((t) => (
                        <li key={t.id} className="text-sm text-zinc-800">
                          {t.name}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Rename teams under{" "}
              <Link href="/admin/teams" className="font-medium text-emerald-800 underline">
                Teams
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">Playoff bracket</h2>
            {active.bracket ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
                <p className="text-sm font-medium text-zinc-900">{active.bracket.name}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {formatLabel(active.bracket.format)}
                  {active.bracket.avoidRematchesUntilForced ? " · avoid rematches" : ""}
                  {" · "}
                  {active.bracket.rounds} rounds · {active.bracket.games} games ·{" "}
                  {active.bracket.published ? "Published" : "Hidden"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href="/admin/brackets"
                    className="inline-flex text-sm font-medium text-emerald-800 underline"
                  >
                    Open brackets admin
                  </Link>
                  {canConfigure && active.seedBoard ? (
                    <Link
                      href="/admin/structure?builder=1"
                      className="inline-flex text-sm font-medium text-emerald-800 underline"
                    >
                      Edit Round 1 seeds
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                No bracket yet.{" "}
                {canConfigure ? (
                  <Link href="/admin/brackets" className="font-medium text-emerald-800 underline">
                    Create one
                  </Link>
                ) : null}
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
