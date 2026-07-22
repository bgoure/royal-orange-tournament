/**
 * Generate double-elimination bracket map PDFs in the “center R1 / winners right / losers left”
 * poster style (see reference 27-team schedule). Covers every field size from 6–50 teams.
 *
 * Usage: npm run bracket-maps:generate
 * Output: docs/bracket-maps/double-elimination-6-to-50.pdf
 *         docs/bracket-maps/triple-elimination-6-to-50.pdf (adapted 3-life layout)
 */

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const OUT_DIR = path.join(process.cwd(), "docs", "bracket-maps");
const TEAM_MIN = 6;
const TEAM_MAX = 50;

// --- colors matching the reference poster ---
const BLUE = "#1e3a8a";
const BLUE_MID = "#2563eb";
const BLUE_LIGHT = "#dbeafe";
const CARD = "#1d4ed8";
const CARD_EDGE = "#1e40af";
const RED = "#b91c1c";
const GREEN = "#15803d";
const YELLOW = "#fef08a";
const YELLOW_EDGE = "#ca8a04";
const SLATE = "#334155";
const MUTED = "#64748b";
const COL_BAND = "#eff6ff";
const COL_BAND_ALT = "#f8fafc";

type SideRef =
  | { kind: "seed"; n: number }
  | { kind: "bye" }
  | { kind: "winner"; gameId: number }
  | { kind: "loser"; gameId: number }
  | { kind: "redraw"; label: string };

type GameCard = {
  id: number;
  /** Global schedule round (1 = center column). */
  round: number;
  /** Horizontal lane: negative = losers (left), 0 = R1, positive = winners (right). */
  lane: number;
  home: SideRef;
  away: SideRef;
  /** Shown under card */
  note?: string;
  noteColor?: "red" | "green" | "amber";
  redraw?: boolean;
};

type BracketPlan = {
  teamCount: number;
  games: GameCard[];
  maxRound: number;
  minLane: number;
  maxLane: number;
  byeSeeds: number[];
  notes: string[];
};

function refLabel(r: SideRef): string {
  switch (r.kind) {
    case "seed":
      return `Seed ${r.n}`;
    case "bye":
      return "BYE";
    case "winner":
      return `G${r.gameId} Winner`;
    case "loser":
      return `G${r.gameId} Loser`;
    case "redraw":
      return r.label;
  }
}

/** Pair list into games; leftover seeds get byes (returned separately). */
function pairSeeds(seeds: number[]): { pairs: [number, number][]; byes: number[] } {
  const byes: number[] = [];
  const work = [...seeds];
  if (work.length % 2 === 1) {
    // Highest seed (lowest number) gets the bye — classic.
    byes.push(work.shift()!);
  }
  const pairs: [number, number][] = [];
  // High vs low pairing within remaining
  while (work.length >= 2) {
    const a = work.shift()!;
    const b = work.pop()!;
    pairs.push([a, b]);
  }
  return { pairs, byes };
}

/**
 * Build a schedule-style double-elim like the reference poster:
 * - R1 center: floor(N/2) games + bye(s)
 * - Winners lanes to the right, losers lanes to the left
 * - Late rounds become rematch-avoiding re-draws when ≤6 teams remain in play
 */
function buildDoubleElimPlan(teamCount: number): BracketPlan {
  const games: GameCard[] = [];
  let nextId = 1;
  const notes: string[] = [];

  const allSeeds = Array.from({ length: teamCount }, (_, i) => i + 1);
  const { pairs, byes } = pairSeeds(allSeeds);
  const byeSeeds = byes;

  // --- Round 1 (lane 0) ---
  const r1Games: GameCard[] = [];
  for (const [a, b] of pairs) {
    const g: GameCard = {
      id: nextId++,
      round: 1,
      lane: 0,
      home: { kind: "seed", n: a },
      away: { kind: "seed", n: b },
      note: `Loser → losers bracket`,
      noteColor: "amber",
    };
    r1Games.push(g);
    games.push(g);
  }
  if (byeSeeds.length) {
    notes.push(
      `Round 1 bye(s): ${byeSeeds.map((s) => `Seed ${s}`).join(", ")} advance undefeated (no game).`,
    );
  }

  // Track undefeated sources and one-loss sources as SideRefs for pairing
  type Slot = { ref: SideRef; losses: 0 | 1 };
  let undefeated: Slot[] = [
    ...r1Games.map((g) => ({ ref: { kind: "winner" as const, gameId: g.id }, losses: 0 as const })),
    ...byeSeeds.map((n) => ({ ref: { kind: "seed" as const, n }, losses: 0 as const })),
  ];
  let oneLoss: Slot[] = r1Games.map((g) => ({
    ref: { kind: "loser" as const, gameId: g.id },
    losses: 1 as const,
  }));

  let round = 2;
  let wLane = 1;
  let lLane = -1;

  // Continue until we can form a championship path
  // Cap rounds for safety
  for (let guard = 0; guard < 40; guard++) {
    const alive = undefeated.length + oneLoss.length;
    if (alive <= 2) break;

    // Late-stage: rematch-avoiding redraw when total alive <= 6 and we've had a few rounds
    const useRedraw = alive <= 6 && round >= 4;

    if (useRedraw) {
      const pool = [...undefeated, ...oneLoss];
      pool.sort((a, b) => refLabel(a.ref).localeCompare(refLabel(b.ref)));
      const work = [...pool];
      let byeSlot: Slot | null = null;
      if (work.length % 2 === 1) byeSlot = work.shift()!;

      const redrawGames: GameCard[] = [];
      const paired: Array<{ a: Slot; b: Slot; g: GameCard }> = [];
      while (work.length >= 2) {
        const a = work.shift()!;
        const b = work.shift()!;
        const eitherAlreadyOneLoss = a.losses === 1 || b.losses === 1;
        const g: GameCard = {
          id: nextId++,
          round,
          lane: wLane,
          home: a.ref,
          away: b.ref,
          redraw: true,
          note: eitherAlreadyOneLoss
            ? "Re-draw · loser eliminated if already 1-loss"
            : "Re-draw · avoid prior matchups where possible",
          noteColor: eitherAlreadyOneLoss ? "red" : "amber",
        };
        redrawGames.push(g);
        paired.push({ a, b, g });
        games.push(g);
      }

      notes.push(
        `Round ${round}: ${alive} teams remain — matchups re-drawn avoiding previous matchups where possible; otherwise a draw decides pairings.`,
      );
      if (byeSlot) {
        notes.push(`Round ${round}: ${refLabel(byeSlot.ref)} draws a bye this wave.`);
      }

      // Next wave: keep winner refs; drop undefeated-losers into oneLoss; eliminate 1-loss losers
      const nextU: Slot[] = [];
      const nextO: Slot[] = [];
      if (byeSlot) {
        if (byeSlot.losses === 0) nextU.push(byeSlot);
        else nextO.push(byeSlot);
      }
      for (const { a, b, g } of paired) {
        nextU.push({ ref: { kind: "winner", gameId: g.id }, losses: 0 });
        // Unknown who loses — for structure maps, place a "loser" slot into oneLoss only when BOTH were undefeated
        if (a.losses === 0 && b.losses === 0) {
          nextO.push({ ref: { kind: "loser", gameId: g.id }, losses: 1 });
        }
      }
      undefeated = nextU;
      oneLoss = nextO;

      if (undefeated.length + oneLoss.length <= 2) {
        notes.push(
          `Rounds ${round + 1}+ : championship — undefeated vs last 1-loss survivor; if 1-loss wins, optional IF rematch (policy TBD).`,
        );
      }
      round++;
      wLane++;
      continue;
    }

    // --- Winners games (undefeated vs undefeated) ---
    const wWork = [...undefeated];
    wWork.sort((a, b) => refLabel(a.ref).localeCompare(refLabel(b.ref)));
    let wBye: Slot | null = null;
    if (wWork.length % 2 === 1) wBye = wWork.shift()!;
    const wGames: GameCard[] = [];
    const nextUndefeated: Slot[] = wBye ? [wBye] : [];
    const dropToLosers: SideRef[] = [];

    while (wWork.length >= 2) {
      const a = wWork.shift()!;
      const b = wWork.shift()!;
      const g: GameCard = {
        id: nextId++,
        round,
        lane: wLane,
        home: a.ref,
        away: b.ref,
        note: "Loser → losers bracket",
        noteColor: "amber",
      };
      wGames.push(g);
      games.push(g);
      nextUndefeated.push({ ref: { kind: "winner", gameId: g.id }, losses: 0 });
      dropToLosers.push({ kind: "loser", gameId: g.id });
    }

    // --- Losers games ---
    // Incoming: existing oneLoss + drops from this winners round
    const lPool: Slot[] = [
      ...oneLoss,
      ...dropToLosers.map((ref) => ({ ref, losses: 1 as const })),
    ];
    lPool.sort((a, b) => refLabel(a.ref).localeCompare(refLabel(b.ref)));
    let lBye: Slot | null = null;
    if (lPool.length % 2 === 1) lBye = lPool.shift()!;
    const lGames: GameCard[] = [];
    const nextOneLoss: Slot[] = lBye ? [lBye] : [];

    while (lPool.length >= 2) {
      const a = lPool.shift()!;
      const b = lPool.shift()!;
      const g: GameCard = {
        id: nextId++,
        round,
        lane: lLane,
        home: a.ref,
        away: b.ref,
        note: "Loser is eliminated",
        noteColor: "red",
      };
      lGames.push(g);
      games.push(g);
      nextOneLoss.push({ ref: { kind: "winner", gameId: g.id }, losses: 1 });
    }

    if (wGames.length === 0 && lGames.length === 0) break;

    undefeated = nextUndefeated;
    oneLoss = nextOneLoss;
    round++;
    wLane++;
    lLane--;
  }

  // Championship card(s) on far right
  const finalRound = round;
  const gf: GameCard = {
    id: nextId++,
    round: finalRound,
    lane: wLane,
    home: { kind: "redraw", label: "Undefeated champ" },
    away: { kind: "redraw", label: "Losers champ" },
    note: "Grand Final · if losers champ wins, optional IF (policy TBD)",
    noteColor: "green",
  };
  games.push(gf);

  notes.push(
    "Late rounds: when few teams remain, matchups are re-drawn avoiding previous meetings where possible (same idea as your 27-team Round 6+ notes).",
  );

  const lanes = games.map((g) => g.lane);
  return {
    teamCount,
    games,
    maxRound: Math.max(...games.map((g) => g.round)),
    minLane: Math.min(...lanes),
    maxLane: Math.max(...lanes),
    byeSeeds,
    notes,
  };
}

/** Triple-elim adaptation: same poster layout but L2 lane further left; third loss eliminates. */
function buildTripleElimPlan(teamCount: number): BracketPlan {
  // Start from double plan then retarget: losers-lane games that would eliminate instead drop to L2.
  const base = buildDoubleElimPlan(teamCount);
  const games: GameCard[] = [];
  let nextId = Math.max(...base.games.map((g) => g.id)) + 1;
  const l2Lane = base.minLane - 1;
  const notes = [
    "PROPOSED triple-elim poster (not shipped). Same center/right/left idea; third loss eliminates in L2.",
    ...base.notes.filter((n) => !n.startsWith("Late rounds")),
  ];

  for (const g of base.games) {
    if (g.lane < 0 && g.noteColor === "red") {
      // Convert elimination losers games into “drop to L2”
      games.push({
        ...g,
        note: "Loser → L2 (2-loss bracket)",
        noteColor: "amber",
      });
      games.push({
        id: nextId++,
        round: g.round,
        lane: l2Lane,
        home: { kind: "loser", gameId: g.id },
        away: { kind: "redraw", label: "L2 opponent / bye" },
        note: "Loser is eliminated (3rd loss)",
        noteColor: "red",
      });
    } else {
      games.push(g);
    }
  }

  const lanes = games.map((g) => g.lane);
  return {
    teamCount,
    games,
    maxRound: Math.max(...games.map((g) => g.round)),
    minLane: Math.min(...lanes),
    maxLane: Math.max(...lanes),
    byeSeeds: base.byeSeeds,
    notes,
  };
}

// --- Drawing ---

const CARD_W = 118;
const CARD_H = 52;
const COL_GAP = 28;
const HEADER_H = 36;

function pageSizeFor(plan: BracketPlan): [number, number] {
  const lanes = plan.maxLane - plan.minLane + 1;
  const width = Math.max(1100, 80 + lanes * (CARD_W + COL_GAP) + 80);
  // Tallest column game count
  const byLane = new Map<number, number>();
  for (const g of plan.games) {
    byLane.set(g.lane, (byLane.get(g.lane) ?? 0) + 1);
  }
  let maxGames = 1;
  for (const c of byLane.values()) maxGames = Math.max(maxGames, c);
  const height = Math.max(720, 100 + maxGames * (CARD_H + 14) + 120);
  return [width, height];
}

function drawGameCard(
  doc: PDFKit.PDFDocument,
  g: GameCard,
  x: number,
  y: number,
) {
  // meta line
  doc.fontSize(5.5).fillColor(MUTED).font("Helvetica");
  doc.text(`Field · TBD`, x, y - 9, { width: CARD_W, align: "left", lineBreak: false });

  const fill = g.redraw ? "#1e40af" : CARD;
  doc.roundedRect(x, y, CARD_W, CARD_H, 3).fillAndStroke(fill, CARD_EDGE);

  // G# badge
  doc.roundedRect(x + 3, y + 3, 28, 12, 2).fill("#eff6ff");
  doc.fillColor(BLUE).fontSize(7).font("Helvetica-Bold");
  doc.text(`G${g.id}`, x + 3, y + 4, { width: 28, align: "center", lineBreak: false });

  if (g.redraw) {
    doc.fillColor(YELLOW).fontSize(5.5).font("Helvetica-Bold");
    doc.text("RE-DRAW", x + 34, y + 5, { lineBreak: false });
  }

  // team rows + score boxes
  const rows = [refLabel(g.home), refLabel(g.away)];
  for (let i = 0; i < 2; i++) {
    const ty = y + 18 + i * 15;
    doc.fillColor("#ffffff").fontSize(6.5).font("Helvetica");
    doc.text(rows[i]!, x + 6, ty, { width: CARD_W - 34, lineBreak: false, ellipsis: true });
    doc.rect(x + CARD_W - 24, ty - 1, 9, 10).fillAndStroke("#fff", "#93c5fd");
    doc.rect(x + CARD_W - 13, ty - 1, 9, 10).fillAndStroke("#86efac", "#16a34a");
  }

  if (g.note) {
    const c = g.noteColor === "red" ? RED : g.noteColor === "green" ? GREEN : "#a16207";
    doc.fillColor(c).fontSize(5).font("Helvetica");
    doc.text(g.note, x, y + CARD_H + 2, { width: CARD_W, align: "left" });
  }
}

function laneTitle(lane: number, round: number, teamCountApprox: number): string {
  if (lane === 0) return `Round ${round} · Opening`;
  if (lane > 0) return `Round ${round} · Winners`;
  return `Round ${round} · Losers`;
}

function drawPlanPage(doc: PDFKit.PDFDocument, plan: BracketPlan, kind: "double" | "triple") {
  const [W, H] = pageSizeFor(plan);
  doc.addPage({ size: [W, H], margins: 0 });

  // background
  doc.rect(0, 0, W, H).fill("#ffffff");

  // title bar
  doc.rect(0, 0, W, 44).fill(BLUE);
  doc.fillColor("#fff").fontSize(14).font("Helvetica-Bold");
  const title =
    kind === "double"
      ? `Double Elimination · ${plan.teamCount} Teams`
      : `Triple Elimination (proposed) · ${plan.teamCount} Teams`;
  doc.text(title, 24, 14, { lineBreak: false });
  doc.fontSize(9).font("Helvetica");
  doc.text(
    `G1–G${Math.max(...plan.games.map((g) => g.id))} · losers left · winners right · center = Round 1`,
    24,
    30,
    { lineBreak: false },
  );

  // column bands
  const lanes: number[] = [];
  for (let L = plan.minLane; L <= plan.maxLane; L++) lanes.push(L);
  const totalCols = lanes.length;
  const usableW = W - 48;
  const colW = usableW / totalCols;
  const originX = 24;
  const originY = 70;

  for (let i = 0; i < lanes.length; i++) {
    const L = lanes[i]!;
    const x = originX + i * colW;
    doc.rect(x, originY - 8, colW - 4, H - originY - 40).fill(i % 2 === 0 ? COL_BAND : COL_BAND_ALT);
  }

  // headers + cards
  const positions = new Map<number, { x: number; y: number; cx: number; cy: number }>();

  for (let i = 0; i < lanes.length; i++) {
    const L = lanes[i]!;
    const colX = originX + i * colW;
    const colGames = plan.games
      .filter((g) => g.lane === L)
      .sort((a, b) => a.id - b.id);

    const roundNum = colGames[0]?.round ?? 1;
    const aliveGuess =
      L === 0
        ? plan.teamCount
        : Math.max(2, Math.round(plan.teamCount * Math.pow(0.75, Math.abs(L))));

    // header pill
    doc.roundedRect(colX + 4, originY - 4, colW - 12, HEADER_H - 8, 3).fill(BLUE);
    doc.fillColor("#fff").fontSize(7).font("Helvetica-Bold");
    const head =
      L < 0
        ? `Losers · R${roundNum}`
        : L === 0
          ? `Round 1`
          : L === plan.maxLane
            ? `Finals`
            : `Winners · R${roundNum}`;
    doc.text(head, colX + 8, originY + 2, { width: colW - 20, align: "center", lineBreak: false });
    doc.fontSize(5.5).font("Helvetica");
    doc.text(
      L === 0
        ? `${colGames.length} games` +
            (plan.byeSeeds.length ? ` · ${plan.byeSeeds.length} bye` : "")
        : `~${aliveGuess} teams remaining`,
      colX + 8,
      originY + 14,
      { width: colW - 20, align: "center", lineBreak: false },
    );

    const stackH = colGames.length * (CARD_H + 18);
    let y = originY + HEADER_H + Math.max(0, (H - originY - 80 - stackH) / 2);

    for (const g of colGames) {
      const x = colX + (colW - CARD_W) / 2 - 2;
      drawGameCard(doc, g, x, y);
      positions.set(g.id, {
        x,
        y,
        cx: x + CARD_W / 2,
        cy: y + CARD_H / 2,
      });
      y += CARD_H + 18;
    }
  }

  // connector lines: winner of G feeds into cards that reference it
  doc.save();
  for (const g of plan.games) {
    const to = positions.get(g.id);
    if (!to) continue;
    for (const side of [g.home, g.away]) {
      if (side.kind !== "winner" && side.kind !== "loser") continue;
      const from = positions.get(side.gameId);
      if (!from) continue;
      const isDrop = side.kind === "loser";
      doc.strokeColor(isDrop ? "#94a3b8" : BLUE_MID).lineWidth(0.8);
      const x1 = from.x + (from.x < to.x ? CARD_W : 0);
      const y1 = from.cy;
      const x2 = to.x + (from.x < to.x ? 0 : CARD_W);
      const y2 = to.y + 24;
      const mid = (x1 + x2) / 2;
      doc
        .moveTo(x1, y1)
        .bezierCurveTo(mid, y1, mid, y2, x2, y2)
        .stroke();
    }
  }
  doc.restore();

  // bye callout
  if (plan.byeSeeds.length) {
    doc.roundedRect(24, H - 36, 320, 22, 3).fillAndStroke(YELLOW, YELLOW_EDGE);
    doc.fillColor(SLATE).fontSize(7).font("Helvetica");
    doc.text(
      `BYE Round 1: ${plan.byeSeeds.map((s) => `Seed ${s}`).join(", ")} (no game — undefeated)`,
      30,
      H - 30,
      { lineBreak: false },
    );
  }

  // footer notes (truncated)
  const note = plan.notes[0];
  if (note) {
    doc.fillColor(MUTED).fontSize(6).font("Helvetica");
    doc.text(note, 360, H - 32, { width: W - 380, lineBreak: false, ellipsis: true });
  }
}

function addCover(doc: PDFKit.PDFDocument, kind: "double" | "triple") {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 40 });
  doc.rect(0, 0, 800, 60).fill(BLUE);
  doc.fillColor("#fff").fontSize(18).font("Helvetica-Bold");
  doc.text(
    kind === "double"
      ? "Double Elimination Bracket Maps (poster style)"
      : "Triple Elimination Bracket Maps (proposed)",
    40,
    22,
  );
  doc.fillColor(SLATE).fontSize(11).font("Helvetica");
  doc.text(`One landscape poster page per field size · ${TEAM_MIN}–${TEAM_MAX} teams`, 40, 80);
  doc.moveDown();
  doc.fontSize(10);
  const lines =
    kind === "double"
      ? [
          "Layout matches your 27-team reference: Round 1 in the center, winners bracket to the right, losers bracket to the left.",
          "Each card: game number (G#), two slots, score boxes, and fate notes (drop / eliminated / re-draw).",
          "Grey curves = loser drops into the losers bracket; blue curves = winner advances.",
          "When few teams remain, cards marked RE-DRAW use rematch-avoiding pairing notes (same idea as your Round 6+).",
          "Seeds are placeholders (Seed 1…N). Field/time are TBD for scheduling later.",
          "This is a review packet for structure — not a live schedule export from the app.",
        ]
      : [
          "Same poster layout as double-elim, extended with an L2 (2-loss) lane further left.",
          "PROPOSED only — triple elimination is not implemented in Tournament Hub yet.",
          "Third loss eliminates; late re-draw notes still apply when the field is small.",
        ];
  for (const line of lines) {
    doc.fillColor(SLATE).text(`•  ${line}`, { paragraphGap: 6 });
  }
}

function addIndex(doc: PDFKit.PDFDocument, kind: "double" | "triple") {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 36 });
  doc.fontSize(14).fillColor(BLUE).font("Helvetica-Bold").text("Index");
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor(SLATE).font("Helvetica");
  let y = 70;
  let x = 36;
  for (let n = TEAM_MIN; n <= TEAM_MAX; n++) {
    const plan = kind === "double" ? buildDoubleElimPlan(n) : buildTripleElimPlan(n);
    const losers = plan.games.filter((g) => g.lane < 0).length;
    const winners = plan.games.filter((g) => g.lane > 0).length;
    const r1 = plan.games.filter((g) => g.lane === 0).length;
    doc.text(
      `${n} teams · ${plan.games.length} games (R1 ${r1} · W ${winners} · L ${losers}) · byes ${plan.byeSeeds.length}`,
      x,
      y,
    );
    y += 11;
    if (y > 560) {
      y = 70;
      x += 380;
    }
  }
}

async function writePdf(kind: "double" | "triple", fileName: string) {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, fileName);
  const doc = new PDFDocument({ autoFirstPage: false, info: { Title: fileName } });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  addCover(doc, kind);
  addIndex(doc, kind);
  for (let n = TEAM_MIN; n <= TEAM_MAX; n++) {
    const plan = kind === "double" ? buildDoubleElimPlan(n) : buildTripleElimPlan(n);
    drawPlanPage(doc, plan, kind);
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return outPath;
}

async function main() {
  const d = await writePdf("double", "double-elimination-6-to-50-poster.pdf");
  const t = await writePdf("triple", "triple-elimination-6-to-50-poster.pdf");
  // Also refresh canonical names when not locked
  for (const [src, dest] of [
    ["double-elimination-6-to-50-poster.pdf", "double-elimination-6-to-50.pdf"],
    ["triple-elimination-6-to-50-poster.pdf", "triple-elimination-6-to-50.pdf"],
  ] as const) {
    try {
      await fs.promises.copyFile(path.join(OUT_DIR, src), path.join(OUT_DIR, dest));
    } catch {
      console.warn(`Could not overwrite ${dest} (file open?) — use ${src}`);
    }
  }
  console.log("Wrote:");
  console.log(" ", d);
  console.log(" ", t);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
