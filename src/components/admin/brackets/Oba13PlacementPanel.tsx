"use client";

import { useActionState, useMemo, useState } from "react";
import {
  applyOba13PlacementAction,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import type { Oba13PlacementBoard } from "@/lib/services/oba-de-13-placement";
import { OBA13_GAME } from "@/lib/services/oba-de-13";

const btnPrimary =
  "rounded-lg bg-royal px-3 py-2 text-sm font-medium text-white hover:bg-royal-800 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900";

type MatchupState = { gameNumber: string; homeTeamId: string; awayTeamId: string };

function defaultMatchups(board: Oba13PlacementBoard): MatchupState[] {
  const suggested = board.suggestion.matchups.map(([home, away], i) => ({
    gameNumber: board.targetGameNumbers.filter((n) => !/bye/i.test(n))[i] ?? "",
    homeTeamId: home,
    awayTeamId: away,
  }));
  if (board.phase === "r5") {
    return [
      { gameNumber: OBA13_GAME.G21, homeTeamId: suggested[0]?.homeTeamId ?? "", awayTeamId: suggested[0]?.awayTeamId ?? "" },
      { gameNumber: OBA13_GAME.G22, homeTeamId: suggested[1]?.homeTeamId ?? "", awayTeamId: suggested[1]?.awayTeamId ?? "" },
    ];
  }
  if (board.phase === "r6" && board.branch === "B") {
    return [
      { gameNumber: OBA13_GAME.G23B, homeTeamId: suggested[0]?.homeTeamId ?? "", awayTeamId: suggested[0]?.awayTeamId ?? "" },
      { gameNumber: OBA13_GAME.G24B, homeTeamId: suggested[1]?.homeTeamId ?? "", awayTeamId: suggested[1]?.awayTeamId ?? "" },
    ];
  }
  if (board.phase === "r6") {
    return [
      { gameNumber: OBA13_GAME.G23A, homeTeamId: suggested[0]?.homeTeamId ?? "", awayTeamId: suggested[0]?.awayTeamId ?? "" },
    ];
  }
  return [
    { gameNumber: OBA13_GAME.G24A, homeTeamId: suggested[0]?.homeTeamId ?? "", awayTeamId: suggested[0]?.awayTeamId ?? "" },
  ];
}

export function Oba13PlacementPanel({ board }: { board: Oba13PlacementBoard }) {
  const [state, action, pending] = useActionState(
    applyOba13PlacementAction,
    undefined as BracketActionResult | undefined,
  );
  const [byeTeamId, setByeTeamId] = useState(board.suggestion.byeTeamId ?? "");
  const [matchups, setMatchups] = useState<MatchupState[]>(() => defaultMatchups(board));

  const needsBye = board.phase !== "r6" || board.branch !== "B";
  const eligible = useMemo(() => new Set(board.eligibleByeTeamIds), [board.eligibleByeTeamIds]);

  function applySuggestion() {
    setByeTeamId(board.suggestion.byeTeamId ?? "");
    setMatchups(defaultMatchups(board));
  }

  const title =
    board.phase === "r5"
      ? "Round 5 placement"
      : board.phase === "r7"
        ? "Round 7 placement (Bracket A)"
        : board.branch === "B"
          ? "Round 6 placement — Bracket B"
          : "Round 6 placement — Bracket A";

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 text-xs text-zinc-600">{board.note}</p>
      {board.suggestion.forced ? (
        <p className="mt-1 text-xs text-amber-800">
          Every pairing includes a rematch — suggestion uses the fewest rematches.
        </p>
      ) : null}
      <ActionMessage state={state} />
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="bracketId" value={board.bracketId} />
        <input type="hidden" name="phase" value={board.phase} />
        <input type="hidden" name="matchups" value={JSON.stringify(matchups)} />
        {needsBye ? <input type="hidden" name="byeTeamId" value={byeTeamId} /> : null}

        {needsBye ? (
          <label className="text-xs font-medium text-zinc-700">
            Bye
            <select
              value={byeTeamId}
              onChange={(e) => setByeTeamId(e.target.value)}
              className={`${formClass} mt-1 w-full`}
              required
            >
              <option value="">Select team…</option>
              {board.remaining.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {eligible.has(t.id) ? " · RP5.2 eligible" : ""}
                  {board.suggestion.byeTeamId === t.id ? " · suggested" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {matchups.map((m, i) => (
          <div key={m.gameNumber} className="grid gap-2 sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Game {m.gameNumber}
            </p>
            {(["homeTeamId", "awayTeamId"] as const).map((side) => (
              <label key={side} className="text-xs font-medium text-zinc-700">
                {side === "homeTeamId" ? "Home" : "Away"}
                <select
                  value={m[side]}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMatchups((prev) => {
                      const next = [...prev];
                      next[i] = { ...next[i]!, [side]: v };
                      return next;
                    });
                  }}
                  className={`${formClass} mt-1 w-full`}
                  required
                >
                  <option value="">Select team…</option>
                  {board.remaining.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={applySuggestion}>
            Apply RP5.2 suggestion
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Save placement"}
          </button>
        </div>
      </form>
    </div>
  );
}
