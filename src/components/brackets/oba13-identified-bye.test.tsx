/**
 * Public 13-team A-bracket: once the R7 sit-out is known, drop the explainer
 * and show that team name on G25A instead of "Round 7 Bye Team".
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { JSDOM } from "jsdom";
import { BracketByeCard } from "@/components/brackets/BracketByeCard";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import { BracketViewerPrefsProvider } from "@/components/brackets/BracketViewerPrefs";
import type { GameRow, TeamWithPool } from "@/components/brackets/bracket-types";
import { oba13R7ByeCardFootnote } from "@/lib/services/oba-de-13";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, "HTMLElement", { value: dom.window.HTMLElement, configurable: true });
Object.defineProperty(globalThis, "HTMLImageElement", {
  value: dom.window.HTMLImageElement,
  configurable: true,
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
}
if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const westToronto: TeamWithPool = {
  id: "wt",
  poolId: "pool-1",
  name: "West Toronto Wildcats",
  seed: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  pool: null,
  logo: { mimeType: "image/png", updatedAt: new Date("2026-01-01") },
};

function g25aEmpty(): GameRow {
  const now = new Date("2026-09-06T18:00:00.000Z");
  return {
    id: "g25a",
    tournamentId: "t1",
    gameNumber: "25A",
    poolId: null,
    gameKind: "PLAYOFF",
    divisionId: null,
    consolationHomePoolId: null,
    consolationHomeRank: null,
    consolationAwayPoolId: null,
    consolationAwayRank: null,
    fieldId: "f1",
    homeTeamId: null,
    awayTeamId: null,
    scheduledAt: now,
    schedulePlaceholder: false,
    status: "SCHEDULED",
    resultType: "REGULAR",
    homeRuns: null,
    awayRuns: null,
    homeDefensiveInnings: null,
    awayDefensiveInnings: null,
    homeOffensiveInnings: null,
    awayOffensiveInnings: null,
    bracketId: "b1",
    bracketRoundId: "r8",
    bracketPosition: 0,
    createdAt: now,
    updatedAt: now,
    homeTeam: null,
    awayTeam: null,
    field: { id: "f1", tournamentId: "t1", locationId: "l1", name: "Concord Regional #4", sortOrder: 0, location: { name: "Concord" } },
    bracketRound: {
      id: "r8",
      bracketId: "b1",
      name: "Round 8",
      roundIndex: 7,
      roundType: "FINAL",
    },
    bracketMatch: {
      id: "bm25",
      gameId: "g25a",
      bracketId: "b1",
      roundId: "r8",
      matchIndex: 0,
      homeSourcePoolId: null,
      homeSourceRank: null,
      awaySourcePoolId: null,
      awaySourceRank: null,
      homeFromMatchId: null,
      awayFromMatchId: "bm-r7",
      homeFromKind: "WINNER",
      awayFromKind: "WINNER",
      homeIsBye: false,
      awayIsBye: false,
      homeSourcePool: null,
      awaySourcePool: null,
      homeFromMatch: {
        id: "bm24",
        matchIndex: 0,
        game: { id: "g24a", gameNumber: "24A" },
      },
      awayFromMatch: {
        id: "bm-r7",
        matchIndex: 0,
        game: { id: "r7-bye", gameNumber: "R7 Bye" },
      },
    },
  } as GameRow;
}

function render(node: Parameters<typeof createElement>[0], props: Record<string, unknown>) {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const root = createRoot(mount);
  act(() => {
    root.render(createElement(BracketViewerPrefsProvider, null, createElement(node, props)));
  });
  return { mount, root };
}

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
});

describe("identified R7 bye public copy", () => {
  it("omits the R7 bye-card explainer after the sitting team is named", () => {
    const identified = render(BracketByeCard, {
      seed: "r7",
      title: "Round 7 Bye Team:",
      teamName: "West Toronto Wildcats",
      team: westToronto,
      footnote: oba13R7ByeCardFootnote({
        identifiedTeamName: "West Toronto Wildcats",
        r7ByeStatus: "award",
        r5ByeName: "Oakville A's",
      }),
    });
    roots.push(identified.root);
    const text = identified.mount.textContent ?? "";
    assert.match(text, /West Toronto Wildcats/);
    assert.doesNotMatch(text, /Winner of G23A/);
    assert.doesNotMatch(text, /Only if/);

    const pending = render(BracketByeCard, {
      seed: "r7-pending",
      title: "Round 7 Bye Team:",
      teamName: "TBD",
      team: null,
      footnote: oba13R7ByeCardFootnote({
        identifiedTeamName: null,
        r7ByeStatus: "award",
        r5ByeName: "Oakville A's",
      }),
    });
    roots.push(pending.root);
    assert.match(pending.mount.textContent ?? "", /Winner of G23A/);
  });

  it("shows the identified team name on G25A instead of Round 7 Bye Team", () => {
    const empty = render(BracketGameCard, {
      game: g25aEmpty(),
      roundIndexDb: 7,
      matchIndex: 0,
      prevRoundName: "Round 7",
      showHomeAway: true,
    });
    roots.push(empty.root);
    assert.match(empty.mount.textContent ?? "", /Round 7/);
    assert.match(empty.mount.textContent ?? "", /Bye Team/);

    const named = render(BracketGameCard, {
      game: g25aEmpty(),
      roundIndexDb: 7,
      matchIndex: 0,
      prevRoundName: "Round 7",
      showHomeAway: true,
      oba13R7ByeName: "West Toronto Wildcats",
      oba13R7ByeTeam: westToronto,
    });
    roots.push(named.root);
    const text = named.mount.textContent ?? "";
    assert.match(text, /West Toronto Wildcats/);
    assert.doesNotMatch(text, /Round 7\s*Bye Team/);
  });
});
