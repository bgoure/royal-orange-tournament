/**
 * PDF review packs for every live playoff option:
 *   double × classic | double × avoid_rematches
 *   triple × classic | triple × avoid_rematches
 * for team counts 6–50 (padded to next power of 2, same as the app).
 *
 * Usage: npm run bracket-maps:generate
 */

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  byeCountForField,
  classicSingleElimOrder,
  doubleElimLosersRoundSizes,
  nextPowerOfTwo,
  singleElimRoundName,
  tripleElimL2RoundSizes,
} from "../src/lib/services/bracket-engine";

const OUT_DIR = path.join(process.cwd(), "docs", "bracket-maps");
const TEAM_MIN = 6;
const TEAM_MAX = 50;

const BLUE = "#1e3a8a";
const BLUE_MID = "#2563eb";
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
const PURPLE = "#6d28d9";

type Format = "double" | "triple";
type Pairing = "classic" | "avoid_rematches";

type SideRef =
  | { kind: "seed"; n: number }
  | { kind: "bye" }
  | { kind: "winner"; gameId: number }
  | { kind: "loser"; gameId: number }
  | { kind: "label"; text: string };

type GameCard = {
  id: number;
  round: number;
  /** 0 = R1 winners, >0 winners, <0 L1, <<0 L2 */
  lane: number;
  home: SideRef;
  away: SideRef;
  note?: string;
  noteColor?: "red" | "green" | "amber" | "purple";
  redraw?: boolean;
};

type BracketPlan = {
  teamCount: number;
  slots: number;
  byes: number;
  format: Format;
  pairing: Pairing;
  games: GameCard[];
  minLane: number;
  maxLane: number;
  notes: string[];
};

function refLabel(r: SideRef): string {
  switch (r.kind) {
    case "seed":
      return `Seed ${r.n}`;
    case "bye":
      return "BYE";
    case "winner":
      return `G${r.gameId} W`;
    case "loser":
      return `G${r.gameId} L`;
    case "label":
      return r.text;
  }
}

function firstRoundSides(teamCount: number): { home: SideRef; away: SideRef }[] {
  const size = nextPowerOfTwo(teamCount);
  const order = classicSingleElimOrder(size);
  const placed: SideRef[] = order.map((seedIndex) =>
    seedIndex < teamCount
      ? { kind: "seed", n: seedIndex + 1 }
      : { kind: "bye" },
  );
  const out: { home: SideRef; away: SideRef }[] = [];
  for (let i = 0; i < size; i += 2) {
    out.push({ home: placed[i]!, away: placed[i + 1]! });
  }
  return out;
}

/** Build a structural map matching createDivisionPlayoffBracket + pairing mode. */
function buildPlan(teamCount: number, format: Format, pairing: Pairing): BracketPlan {
  const slots = nextPowerOfTwo(teamCount);
  const byes = byeCountForField(teamCount);
  const games: GameCard[] = [];
  let nextId = 1;
  const notes: string[] = [];

  const avoid = pairing === "avoid_rematches";
  const winnerRounds = Math.log2(slots) | 0;
  const first = firstRoundSides(teamCount);

  // --- Winners R0 (lane 0) ---
  const r0Ids: number[] = [];
  for (let i = 0; i < first.length; i++) {
    const fr = first[i]!;
    const isBye = fr.home.kind === "bye" || fr.away.kind === "bye";
    const g: GameCard = {
      id: nextId++,
      round: 1,
      lane: 0,
      home: fr.home,
      away: fr.away,
      note: isBye ? "BYE advances undefeated" : "Loser → L1 (1-loss)",
      noteColor: "amber",
    };
    r0Ids.push(g.id);
    games.push(g);
  }

  // --- Later winners rounds (lanes 1..) ---
  let prevIds = r0Ids;
  for (let r = 1; r < winnerRounds; r++) {
    const count = slots / 2 ** (r + 1);
    const ids: number[] = [];
    const name = singleElimRoundName(r, winnerRounds);
    for (let m = 0; m < count; m++) {
      const a = prevIds[m * 2];
      const b = prevIds[m * 2 + 1];
      const isFinal = r === winnerRounds - 1;
      const g: GameCard = {
        id: nextId++,
        round: r + 1,
        lane: r,
        home: a != null ? { kind: "winner", gameId: a } : { kind: "label", text: "TBD" },
        away: b != null ? { kind: "winner", gameId: b } : { kind: "label", text: "TBD" },
        note: isFinal
          ? format === "double" || format === "triple"
            ? "W champ · awaits L champ in GF away"
            : undefined
          : "Loser → L1",
        noteColor: isFinal ? "green" : "amber",
      };
      ids.push(g.id);
      games.push(g);
    }
    prevIds = ids;
  }

  // --- L1 rounds (negative lanes) ---
  const l1Sizes = doubleElimLosersRoundSizes(slots);
  let l1Prev: number[] = [];
  for (let i = 0; i < l1Sizes.length; i++) {
    const size = l1Sizes[i]!;
    const lane = -(i + 1);
    const ids: number[] = [];
    for (let m = 0; m < size; m++) {
      let home: SideRef;
      let away: SideRef;
      if (avoid) {
        home = { kind: "label", text: "Open pool" };
        away = { kind: "label", text: "Open pool" };
      } else if (i === 0) {
        // First L1: drops from R0 (and later W drops fill remaining)
        const dropA = r0Ids[m];
        const dropB = r0Ids[m + size];
        home = dropA != null ? { kind: "loser", gameId: dropA } : { kind: "label", text: "W drop" };
        away = dropB != null ? { kind: "loser", gameId: dropB } : { kind: "label", text: "W drop" };
      } else {
        const a = l1Prev[m * 2];
        const b = l1Prev[m * 2 + 1];
        home = a != null ? { kind: "winner", gameId: a } : { kind: "label", text: "L1 / W drop" };
        away = b != null ? { kind: "winner", gameId: b } : { kind: "label", text: "L1 / W drop" };
      }
      const isLast = i === l1Sizes.length - 1;
      const g: GameCard = {
        id: nextId++,
        round: winnerRounds + i + 1,
        lane,
        home,
        away,
        redraw: avoid,
        note: avoid
          ? isLast
            ? format === "triple"
              ? "RE-DRAW L1 final → winner to L2"
              : "RE-DRAW L1 final → GF"
            : "RE-DRAW · avoid prior matchups"
          : format === "triple"
            ? isLast
              ? "Winner → L2 · Loser → L2"
              : "Loser → L2 (2-loss)"
            : isLast
              ? "Winner → Grand Final · Loser out"
              : "Loser is eliminated",
        noteColor: avoid ? "purple" : format === "triple" ? "amber" : isLast ? "green" : "red",
      };
      ids.push(g.id);
      games.push(g);
    }
    l1Prev = ids;
  }

  // --- L2 for triple (further left) ---
  if (format === "triple") {
    const l2Sizes = tripleElimL2RoundSizes(slots);
    let l2Prev: number[] = [];
    for (let i = 0; i < l2Sizes.length; i++) {
      const size = l2Sizes[i]!;
      const lane = -(l1Sizes.length + i + 1);
      const ids: number[] = [];
      for (let m = 0; m < size; m++) {
        let home: SideRef;
        let away: SideRef;
        if (avoid) {
          home = { kind: "label", text: "Open pool" };
          away = { kind: "label", text: "Open pool" };
        } else if (i === 0) {
          home = { kind: "label", text: "L1 drop" };
          away = { kind: "label", text: "L1 drop" };
        } else {
          const a = l2Prev[m * 2];
          const b = l2Prev[m * 2 + 1];
          home = a != null ? { kind: "winner", gameId: a } : { kind: "label", text: "L2" };
          away = b != null ? { kind: "winner", gameId: b } : { kind: "label", text: "L2" };
        }
        const isLast = i === l2Sizes.length - 1;
        const g: GameCard = {
          id: nextId++,
          round: winnerRounds + l1Sizes.length + i + 1,
          lane,
          home,
          away,
          redraw: avoid,
          note: avoid
            ? isLast
              ? "RE-DRAW L2 final → GF"
              : "RE-DRAW L2 · avoid prior matchups"
            : isLast
              ? "Winner → Grand Final · Loser out (3rd loss)"
              : "Loser is eliminated (3rd loss)",
          noteColor: avoid ? "purple" : isLast ? "green" : "red",
        };
        ids.push(g.id);
        games.push(g);
      }
      l2Prev = ids;
    }
  }

  // Grand final card on far right
  const gfLane = winnerRounds;
  games.push({
    id: nextId++,
    round: winnerRounds + l1Sizes.length + 2,
    lane: gfLane,
    home: { kind: "label", text: "W champ (0 losses)" },
    away: {
      kind: "label",
      text: format === "triple" ? "L2 champ (2 losses)" : "L1 champ (1 loss)",
    },
    note: "Grand Final · one game (no forced IF series)",
    noteColor: "green",
  });

  if (avoid) {
    notes.push(
      "Avoid duplicate matchups: L1/L2 seats stay open and are re-paired as teams arrive, preferring never-met opponents; if forced, minimize rematches then randomize.",
    );
  } else {
    notes.push(
      "Classic fixed paths: losers drop into predetermined slots (printable feeder lines). Rematches can occur.",
    );
  }
  if (format === "triple") {
    notes.push("Triple: W loss → L1; L1 loss → L2; L2 loss → out; L2 champ vs W champ in GF.");
  } else {
    notes.push("Double: W loss → L1; L1 loss → out; L1 champ vs W champ in GF.");
  }

  const lanes = games.map((g) => g.lane);
  return {
    teamCount,
    slots,
    byes,
    format,
    pairing,
    games,
    minLane: Math.min(...lanes),
    maxLane: Math.max(...lanes),
    notes,
  };
}

const CARD_W = 112;
const CARD_H = 50;
const HEADER_H = 34;

function pageSizeFor(plan: BracketPlan): [number, number] {
  const lanes = plan.maxLane - plan.minLane + 1;
  const width = Math.max(1200, 60 + lanes * (CARD_W + 26) + 60);
  const byLane = new Map<number, number>();
  for (const g of plan.games) byLane.set(g.lane, (byLane.get(g.lane) ?? 0) + 1);
  let maxGames = 1;
  for (const c of byLane.values()) maxGames = Math.max(maxGames, c);
  const height = Math.max(760, 110 + maxGames * (CARD_H + 16) + 100);
  return [width, height];
}

function drawGameCard(doc: PDFKit.PDFDocument, g: GameCard, x: number, y: number) {
  doc.fontSize(5).fillColor(MUTED).font("Helvetica");
  doc.text("Field · TBD", x, y - 8, { width: CARD_W, lineBreak: false });

  const fill = g.redraw ? PURPLE : CARD;
  doc.roundedRect(x, y, CARD_W, CARD_H, 3).fillAndStroke(fill, CARD_EDGE);
  doc.roundedRect(x + 3, y + 3, 26, 11, 2).fill("#eff6ff");
  doc.fillColor(BLUE).fontSize(6.5).font("Helvetica-Bold");
  doc.text(`G${g.id}`, x + 3, y + 4, { width: 26, align: "center", lineBreak: false });
  if (g.redraw) {
    doc.fillColor(YELLOW).fontSize(5).font("Helvetica-Bold");
    doc.text("RE-DRAW", x + 32, y + 5, { lineBreak: false });
  }
  const rows = [refLabel(g.home), refLabel(g.away)];
  for (let i = 0; i < 2; i++) {
    const ty = y + 17 + i * 14;
    doc.fillColor("#fff").fontSize(6).font("Helvetica");
    doc.text(rows[i]!, x + 5, ty, { width: CARD_W - 32, lineBreak: false, ellipsis: true });
    doc.rect(x + CARD_W - 22, ty - 1, 8, 9).fillAndStroke("#fff", "#93c5fd");
    doc.rect(x + CARD_W - 12, ty - 1, 8, 9).fillAndStroke("#86efac", "#16a34a");
  }
  if (g.note) {
    const c =
      g.noteColor === "red"
        ? RED
        : g.noteColor === "green"
          ? GREEN
          : g.noteColor === "purple"
            ? PURPLE
            : "#a16207";
    doc.fillColor(c).fontSize(4.5).font("Helvetica");
    doc.text(g.note, x, y + CARD_H + 1, { width: CARD_W });
  }
}

function drawPlanPage(doc: PDFKit.PDFDocument, plan: BracketPlan) {
  const [W, H] = pageSizeFor(plan);
  doc.addPage({ size: [W, H] as [number, number], margin: 0 });
  doc.rect(0, 0, W, H).fill("#ffffff");

  doc.rect(0, 0, W, 48).fill(BLUE);
  doc.fillColor("#fff").fontSize(13).font("Helvetica-Bold");
  const fmt = plan.format === "double" ? "Double elimination" : "Triple elimination";
  const pair =
    plan.pairing === "classic" ? "Classic fixed paths" : "Avoid duplicate matchups";
  doc.text(`${fmt} · ${pair}`, 20, 10, { lineBreak: false });
  doc.fontSize(9).font("Helvetica");
  doc.text(
    `${plan.teamCount} teams → ${plan.slots}-slot field (${plan.byes} BYE) · G1–G${Math.max(...plan.games.map((g) => g.id))} · center R1 · winners right · losers left`,
    20,
    28,
    { lineBreak: false },
  );

  const lanes: number[] = [];
  for (let L = plan.minLane; L <= plan.maxLane; L++) lanes.push(L);
  const colW = (W - 40) / lanes.length;
  const originX = 20;
  const originY = 72;

  for (let i = 0; i < lanes.length; i++) {
    const x = originX + i * colW;
    doc.rect(x, originY - 6, colW - 3, H - originY - 50).fill(i % 2 === 0 ? COL_BAND : COL_BAND_ALT);
  }

  const positions = new Map<number, { x: number; y: number; cx: number; cy: number }>();

  for (let i = 0; i < lanes.length; i++) {
    const L = lanes[i]!;
    const colX = originX + i * colW;
    const colGames = plan.games.filter((g) => g.lane === L).sort((a, b) => a.id - b.id);

    let head: string;
    if (L === 0) head = "Round 1 · Winners";
    else if (L > 0 && L === plan.maxLane) head = "Grand Final";
    else if (L > 0) head = `Winners · R${L + 1}`;
    else if (plan.format === "triple" && L < -doubleElimLosersRoundSizes(plan.slots).length) {
      head = `L2 · 2 losses`;
    } else head = `L1 · 1 loss`;

    doc.roundedRect(colX + 3, originY - 2, colW - 10, HEADER_H - 8, 3).fill(BLUE);
    doc.fillColor("#fff").fontSize(6.5).font("Helvetica-Bold");
    doc.text(head, colX + 6, originY + 2, { width: colW - 16, align: "center", lineBreak: false });
    doc.fontSize(5).font("Helvetica");
    doc.text(`${colGames.length} games`, colX + 6, originY + 14, {
      width: colW - 16,
      align: "center",
      lineBreak: false,
    });

    const stackH = colGames.length * (CARD_H + 16);
    let y = originY + HEADER_H + Math.max(0, (H - originY - 90 - stackH) / 2);
    for (const g of colGames) {
      const x = colX + (colW - CARD_W) / 2 - 2;
      drawGameCard(doc, g, x, y);
      positions.set(g.id, { x, y, cx: x + CARD_W / 2, cy: y + CARD_H / 2 });
      y += CARD_H + 16;
    }
  }

  doc.save();
  for (const g of plan.games) {
    const to = positions.get(g.id);
    if (!to) continue;
    for (const side of [g.home, g.away]) {
      if (side.kind !== "winner" && side.kind !== "loser") continue;
      const from = positions.get(side.gameId);
      if (!from) continue;
      doc.strokeColor(side.kind === "loser" ? "#94a3b8" : BLUE_MID).lineWidth(0.7);
      const x1 = from.x + (from.x < to.x ? CARD_W : 0);
      const y1 = from.cy;
      const x2 = to.x + (from.x < to.x ? 0 : CARD_W);
      const y2 = to.y + 22;
      const mid = (x1 + x2) / 2;
      doc.moveTo(x1, y1).bezierCurveTo(mid, y1, mid, y2, x2, y2).stroke();
    }
  }
  doc.restore();

  doc.roundedRect(20, H - 40, Math.min(520, W - 40), 26, 3).fillAndStroke(YELLOW, YELLOW_EDGE);
  doc.fillColor(SLATE).fontSize(6.5).font("Helvetica");
  doc.text(plan.notes.join(" "), 26, H - 32, { width: Math.min(508, W - 52), lineBreak: false, ellipsis: true });
}

function addCover(doc: PDFKit.PDFDocument, format: Format, pairing: Pairing) {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 40 });
  doc.rect(0, 0, 800, 56).fill(BLUE);
  doc.fillColor("#fff").fontSize(16).font("Helvetica-Bold");
  const title = `${format === "double" ? "Double" : "Triple"} elimination · ${
    pairing === "classic" ? "Classic fixed paths" : "Avoid duplicate matchups"
  }`;
  doc.text(title, 40, 18);
  doc.fillColor(SLATE).fontSize(10).font("Helvetica");
  doc.text(`Current Tournament Hub engine · team counts ${TEAM_MIN}–${TEAM_MAX}`, 40, 72);
  doc.moveDown();
  const bullets =
    pairing === "classic"
      ? [
          "Matches Admin → Brackets create option: Classic fixed bracket.",
          "Field pads to next power of 2 with BYEs (classic seed order).",
          "Center = winners Round 1; right = winners; left = losers (L1) and L2 if triple.",
          "Grey curves = loser drops; blue = winner advances.",
          "Grand Final: one game, no forced IF rematch series.",
        ]
      : [
          "Matches Admin → Brackets create option: Avoid duplicate matchups.",
          "Same W / L1 / L2 / GF structure as classic, but L1/L2 cards are RE-DRAW pools.",
          "As teams arrive, open rounds are re-paired to prefer never-met opponents.",
          "If every pairing is a rematch, minimize rematches then randomize (forced redraw).",
          "Purple cards = dynamic pairing (not fixed feeder slots).",
        ];
  if (format === "triple") {
    bullets.push("Triple lives: W loss → L1; L1 loss → L2; L2 loss → eliminated; L2 champ vs W champ.");
  }
  for (const b of bullets) {
    doc.text(`•  ${b}`, { paragraphGap: 5 });
  }
}

function addIndex(doc: PDFKit.PDFDocument, format: Format, pairing: Pairing) {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 36 });
  doc.fontSize(13).fillColor(BLUE).font("Helvetica-Bold").text("Index");
  doc.moveDown(0.4);
  doc.fontSize(8).fillColor(SLATE).font("Helvetica");
  let y = 68;
  let x = 36;
  for (let n = TEAM_MIN; n <= TEAM_MAX; n++) {
    const plan = buildPlan(n, format, pairing);
    const l1 = plan.games.filter((g) => g.lane < 0 && (format === "double" || g.lane >= -doubleElimLosersRoundSizes(plan.slots).length)).length;
    const l2 = plan.games.filter((g) => g.lane < -doubleElimLosersRoundSizes(plan.slots).length).length;
    const w = plan.games.filter((g) => g.lane >= 0).length;
    doc.text(
      `${n} → ${plan.slots} slots (${plan.byes} bye) · ${plan.games.length} games (W-ish ${w} · L1 ${l1}${format === "triple" ? ` · L2 ${l2}` : ""})`,
      x,
      y,
    );
    y += 11;
    if (y > 560) {
      y = 68;
      x += 390;
    }
  }
}

async function writePack(format: Format, pairing: Pairing, fileName: string) {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, fileName);
  const doc = new PDFDocument({ autoFirstPage: false, info: { Title: fileName } });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  addCover(doc, format, pairing);
  addIndex(doc, format, pairing);
  for (let n = TEAM_MIN; n <= TEAM_MAX; n++) {
    drawPlanPage(doc, buildPlan(n, format, pairing));
  }
  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return outPath;
}

async function main() {
  const files = [
    await writePack("double", "classic", "option-double-classic-6-to-50.pdf"),
    await writePack("double", "avoid_rematches", "option-double-avoid-rematches-6-to-50.pdf"),
    await writePack("triple", "classic", "option-triple-classic-6-to-50.pdf"),
    await writePack("triple", "avoid_rematches", "option-triple-avoid-rematches-6-to-50.pdf"),
  ];
  console.log("Wrote:");
  for (const f of files) console.log(" ", f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
