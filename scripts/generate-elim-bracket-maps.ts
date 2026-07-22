/**
 * Generate review PDFs: double- and triple-elimination bracket maps for 6–50 teams.
 *
 * Usage: npx tsx scripts/generate-elim-bracket-maps.ts
 * Output: docs/bracket-maps/double-elimination-6-to-50.pdf
 *         docs/bracket-maps/triple-elimination-6-to-50.pdf
 *
 * Conventions (documented on cover pages):
 * - Field size pads to next power of 2 with BYEs (same as Tournament Hub).
 * - Double-elim: winners + losers + one grand final (no forced rematch series).
 * - Triple-elim: proposed W / L1 / L2 model (not shipped in the app yet) — for review only.
 */

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  byeCountForField,
  classicSingleElimOrder,
  nextPowerOfTwo,
  singleElimRoundName,
} from "../src/lib/services/bracket-engine";

const OUT_DIR = path.join(process.cwd(), "docs", "bracket-maps");
const TEAM_MIN = 6;
const TEAM_MAX = 50;

type Side = { label: string; isBye: boolean };

function firstRoundSides(teamCount: number): { home: Side; away: Side }[] {
  const size = nextPowerOfTwo(teamCount);
  const order = classicSingleElimOrder(size);
  const placed: Side[] = order.map((seedIndex) => {
    if (seedIndex < teamCount) {
      return { label: `S${seedIndex + 1}`, isBye: false };
    }
    return { label: "BYE", isBye: true };
  });
  const rounds: { home: Side; away: Side }[] = [];
  for (let i = 0; i < size; i += 2) {
    rounds.push({ home: placed[i]!, away: placed[i + 1]! });
  }
  return rounds;
}

function winnersRoundGameCounts(slots: number): number[] {
  const counts: number[] = [];
  for (let g = slots / 2; g >= 1; g /= 2) counts.push(g);
  return counts;
}

/** Canonical double-elim losers round game counts for a power-of-2 field. */
function doubleLosersRoundGameCounts(slots: number): number[] {
  // Standard: losers has 2*log2(P)-1 rounds with pattern P/2-1, P/2-1, P/4-1, P/4-1, ... then 1
  const rounds = 2 * Math.log2(slots) - 1;
  const out: number[] = [];
  let games = slots / 2 - 1;
  for (let r = 0; r < rounds; r++) {
    out.push(Math.max(1, games));
    // Alternate: after every two losers rounds, halve (when dropping from next winners round)
    if (r % 2 === 1) games = Math.max(1, Math.floor(games / 2));
  }
  // Ensure last is losers final (1)
  out[out.length - 1] = 1;
  return out;
}

/** Proposed triple-elim: L1 similar to double losers; L2 absorbs second losses. */
function tripleL1RoundGameCounts(slots: number): number[] {
  return doubleLosersRoundGameCounts(slots);
}

function tripleL2RoundGameCounts(slots: number): number[] {
  // Roughly another full losers-depth tree for 2-loss teams; end with 1 finalist
  const rounds = Math.max(1, 2 * Math.log2(slots) - 2);
  const out: number[] = [];
  let games = Math.max(1, slots / 2 - 2);
  for (let r = 0; r < rounds; r++) {
    out.push(Math.max(1, games));
    if (r % 2 === 1) games = Math.max(1, Math.floor(games / 2));
  }
  out[out.length - 1] = 1;
  return out;
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function playedFirstRoundGames(first: { home: Side; away: Side }[]) {
  return first.filter((g) => !g.home.isBye && !g.away.isBye).length;
}

function estimateDoubleElimGames(teamCount: number): {
  slots: number;
  byes: number;
  winnersSlots: number;
  losersSlots: number;
  grandFinal: number;
  approxTeamGames: number;
} {
  const slots = nextPowerOfTwo(teamCount);
  const byes = byeCountForField(teamCount);
  const w = winnersRoundGameCounts(slots);
  const l = doubleLosersRoundGameCounts(slots);
  // Real contested games ≈ 2*teamCount - 2 (classic double-elim identity)
  return {
    slots,
    byes,
    winnersSlots: sum(w),
    losersSlots: sum(l),
    grandFinal: 1,
    approxTeamGames: 2 * teamCount - 2,
  };
}

function estimateTripleElimGames(teamCount: number) {
  const slots = nextPowerOfTwo(teamCount);
  const byes = byeCountForField(teamCount);
  const w = winnersRoundGameCounts(slots);
  const l1 = tripleL1RoundGameCounts(slots);
  const l2 = tripleL2RoundGameCounts(slots);
  return {
    slots,
    byes,
    winnersSlots: sum(w),
    l1Slots: sum(l1),
    l2Slots: sum(l2),
    grandFinal: 1,
    // Rough: ~3n - c contested games
    approxTeamGames: 3 * teamCount - 3,
  };
}

function drawBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: { fill?: string; fontSize?: number },
) {
  doc.save();
  doc.roundedRect(x, y, w, h, 2).fillAndStroke(opts?.fill ?? "#ffffff", "#334155");
  doc.fillColor("#0f172a").fontSize(opts?.fontSize ?? 7).font("Helvetica");
  doc.text(text, x + 2, y + (h - (opts?.fontSize ?? 7)) / 2 - 1, {
    width: w - 4,
    align: "center",
    lineBreak: false,
  });
  doc.restore();
}

function drawWinnersTree(
  doc: PDFKit.PDFDocument,
  teamCount: number,
  originX: number,
  originY: number,
  maxWidth: number,
  maxHeight: number,
) {
  const slots = nextPowerOfTwo(teamCount);
  const first = firstRoundSides(teamCount);
  const roundCounts = winnersRoundGameCounts(slots);
  const rounds = roundCounts.length;

  // Cap visual density
  const boxH = Math.min(14, Math.max(8, (maxHeight - 20) / Math.max(first.length, 1) - 2));
  const boxW = Math.min(72, maxWidth / (rounds + 1) - 12);
  const gapY = boxH + 2;

  doc.fontSize(9).fillColor("#1e3a8a").font("Helvetica-Bold").text("Winners bracket", originX, originY - 14);

  // Round 0 positions
  const colXs: number[] = [];
  for (let r = 0; r < rounds; r++) {
    colXs.push(originX + r * (boxW + 18));
  }

  type Node = { x: number; y: number; label: string };
  const nodes: Node[][] = [];

  // Round 0
  const r0: Node[] = [];
  const totalH = first.length * gapY;
  const startY = originY + Math.max(0, (maxHeight - totalH) / 2);
  for (let i = 0; i < first.length; i++) {
    const g = first[i]!;
    const label =
      g.home.isBye || g.away.isBye
        ? `${g.home.label} / ${g.away.label}`
        : `${g.home.label} vs ${g.away.label}`;
    const y = startY + i * gapY;
    const x = colXs[0]!;
    drawBox(doc, x, y, boxW, boxH, label, {
      fill: g.home.isBye || g.away.isBye ? "#ffedd5" : "#eff6ff",
      fontSize: slots >= 32 ? 5.5 : 6.5,
    });
    r0.push({ x: x + boxW, y: y + boxH / 2, label });
  }
  nodes.push(r0);

  // Later rounds: abstract winners
  for (let r = 1; r < rounds; r++) {
    const count = roundCounts[r]!;
    const prev = nodes[r - 1]!;
    const row: Node[] = [];
    const name = singleElimRoundName(r, rounds);
    for (let i = 0; i < count; i++) {
      const a = prev[i * 2];
      const b = prev[i * 2 + 1];
      const y = a && b ? (a.y + b.y) / 2 - boxH / 2 : startY + i * (maxHeight / count);
      const x = colXs[r]!;
      const label = r === rounds - 1 ? "W Final" : `${name} ${i + 1}`;
      drawBox(doc, x, y, boxW, boxH, label, { fill: "#dbeafe", fontSize: 6.5 });
      if (a) {
        doc
          .strokeColor("#94a3b8")
          .moveTo(a.x, a.y)
          .lineTo(x, y + boxH / 2)
          .stroke();
      }
      if (b) {
        doc
          .strokeColor("#94a3b8")
          .moveTo(b.x, b.y)
          .lineTo(x, y + boxH / 2)
          .stroke();
      }
      row.push({ x: x + boxW, y: y + boxH / 2, label });
    }
    nodes.push(row);
  }

  return { endX: colXs[rounds - 1]! + boxW, endY: startY + first.length * gapY };
}

function drawRoundLadder(
  doc: PDFKit.PDFDocument,
  title: string,
  counts: number[],
  x: number,
  y: number,
  width: number,
  color: string,
) {
  doc.fontSize(9).fillColor(color).font("Helvetica-Bold").text(title, x, y);
  let cy = y + 16;
  doc.font("Helvetica").fillColor("#334155").fontSize(7.5);
  for (let i = 0; i < counts.length; i++) {
    const g = counts[i]!;
    const label =
      i === counts.length - 1
        ? `Final · ${g} game`
        : `Round ${i + 1} · ${g} game${g === 1 ? "" : "s"}`;
    doc.roundedRect(x, cy, width, 14, 2).fillAndStroke("#fff", color);
    doc.fillColor("#0f172a").text(label, x + 6, cy + 3, { width: width - 12 });
    if (i < counts.length - 1) {
      doc
        .strokeColor("#cbd5e1")
        .moveTo(x + width / 2, cy + 14)
        .lineTo(x + width / 2, cy + 20)
        .stroke();
    }
    cy += 20;
  }
  return cy;
}

function addCover(
  doc: PDFKit.PDFDocument,
  kind: "double" | "triple",
) {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 36 });
  doc.fontSize(22).fillColor("#1e3a8a").font("Helvetica-Bold");
  doc.text(
    kind === "double" ? "Double Elimination Bracket Maps" : "Triple Elimination Bracket Maps",
    { align: "center" },
  );
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#334155").font("Helvetica");
  doc.text(`Playoff fields for ${TEAM_MIN}–${TEAM_MAX} teams`, { align: "center" });
  doc.moveDown(1);
  doc.fontSize(10).fillColor("#0f172a");
  const bullets =
    kind === "double"
      ? [
          "Padding: each team count pads to the next power of 2 with BYEs (Tournament Hub rule).",
          "Seeding: classic single-elim positions (S1 meets lowest seed late); top seeds get BYEs first.",
          "Structure: Winners bracket → Losers bracket → one Grand Final (no IF necessary rematch series).",
          "Orange boxes = first-round games involving a BYE (auto-advance).",
          "Contested-game estimate uses the classic identity ≈ 2N − 2 for N real teams.",
          "Losers round sizes follow a canonical feed-in pattern for review (may differ slightly from app v1 slot counts).",
        ]
      : [
          "PROPOSED model for review — triple elimination is NOT shipped in Tournament Hub yet.",
          "Padding / seeding: same power-of-2 + BYE + classic seed order as double-elim.",
          "Three lives: lose in W → L1 (1 loss); lose in L1 → L2 (2 losses); lose in L2 → eliminated.",
          "Grand Final: W champion vs L2 champion (one game for these maps; reset rules TBD).",
          "L1 / L2 ladders are schematic round counts for planning day length — validate before coding.",
          "Contested-game estimate ≈ 3N − 3 (order-of-magnitude for field/time planning).",
        ];
  for (const b of bullets) {
    doc.text(`•  ${b}`, { indent: 24, paragraphGap: 4 });
  }
  doc.moveDown(1);
  doc.fontSize(9).fillColor("#64748b");
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)} · Tournament Hub review packet`, {
    align: "center",
  });
}

function addIndexTable(doc: PDFKit.PDFDocument, kind: "double" | "triple") {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 36 });
  doc.fontSize(14).fillColor("#1e3a8a").font("Helvetica-Bold").text("Index — all sizes at a glance");
  doc.moveDown(0.5);

  const startY = doc.y;
  const colW = [40, 40, 40, 55, 55, 55, 70, 90];
  const headers =
    kind === "double"
      ? ["N", "Slots", "Byes", "W games*", "L games*", "GF", "≈ Contested", "Page"]
      : ["N", "Slots", "Byes", "W*", "L1*", "L2*", "≈ Contested", "Page"];

  let x = 36;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#0f172a");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i]!, x, startY, { width: colW[i], align: "left" });
    x += colW[i]!;
  }
  doc
    .moveTo(36, startY + 12)
    .lineTo(760, startY + 12)
    .strokeColor("#cbd5e1")
    .stroke();

  let y = startY + 16;
  doc.font("Helvetica").fontSize(8);
  for (let n = TEAM_MIN; n <= TEAM_MAX; n++) {
    if (y > 560) {
      doc.addPage({ size: "LETTER", layout: "landscape", margin: 36 });
      y = 48;
    }
    const pageNum = n - TEAM_MIN + 3; // cover + index ≈ pages 1-2, then detail
    x = 36;
    const row =
      kind === "double"
        ? (() => {
            const e = estimateDoubleElimGames(n);
            return [
              String(n),
              String(e.slots),
              String(e.byes),
              String(e.winnersSlots),
              String(e.losersSlots),
              "1",
              String(e.approxTeamGames),
              `~${pageNum}`,
            ];
          })()
        : (() => {
            const e = estimateTripleElimGames(n);
            return [
              String(n),
              String(e.slots),
              String(e.byes),
              String(e.winnersSlots),
              String(e.l1Slots),
              String(e.l2Slots),
              String(e.approxTeamGames),
              `~${pageNum}`,
            ];
          })();
    doc.fillColor(n % 2 === 0 ? "#0f172a" : "#334155");
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i]!, x, y, { width: colW[i], align: "left" });
      x += colW[i]!;
    }
    y += 11;
  }
  doc.fontSize(7).fillColor("#64748b").text(
    "* Slot/game counts include bracket positions (BYE auto-advances still occupy a first-round slot). ≈ Contested estimates real team-vs-team games.",
    36,
    575,
    { width: 720 },
  );
}

function addDetailPage(doc: PDFKit.PDFDocument, kind: "double" | "triple", teamCount: number) {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 28 });
  const slots = nextPowerOfTwo(teamCount);
  const byes = byeCountForField(teamCount);

  doc.fontSize(13).fillColor("#1e3a8a").font("Helvetica-Bold");
  doc.text(
    `${kind === "double" ? "Double" : "Triple"} elimination · ${teamCount} teams → ${slots}-slot field (${byes} BYE${byes === 1 ? "" : "s"})`,
    28,
    24,
  );

  if (kind === "double") {
    const e = estimateDoubleElimGames(teamCount);
    doc.fontSize(8).fillColor("#334155").font("Helvetica");
    doc.text(
      `Winners slots ${e.winnersSlots} · Losers slots ${e.losersSlots} · Grand final 1 · ≈ ${e.approxTeamGames} contested games (2N−2)`,
      28,
      42,
    );
  } else {
    const e = estimateTripleElimGames(teamCount);
    doc.fontSize(8).fillColor("#9a3412").font("Helvetica-Bold");
    doc.text("PROPOSED — not implemented in app", 28, 42);
    doc.font("Helvetica").fillColor("#334155");
    doc.text(
      `W ${e.winnersSlots} · L1 ${e.l1Slots} · L2 ${e.l2Slots} · GF 1 · ≈ ${e.approxTeamGames} contested (3N−3)`,
      200,
      42,
    );
  }

  // Winners tree (left)
  const treeMaxH = slots <= 16 ? 480 : slots <= 32 ? 500 : 520;
  drawWinnersTree(doc, teamCount, 28, 70, slots <= 16 ? 420 : 380, treeMaxH);

  // Right side ladders
  const lx = slots <= 16 ? 470 : 430;
  if (kind === "double") {
    const lCounts = doubleLosersRoundGameCounts(slots);
    let y = drawRoundLadder(doc, "Losers bracket (feed-in)", lCounts, lx, 70, 280, "#c2410c");
    y += 12;
    drawBox(doc, lx, y, 280, 22, "Grand Final · W champ vs L champ (1 game)", {
      fill: "#fef3c7",
      fontSize: 8,
    });
    doc.fontSize(7).fillColor("#64748b").font("Helvetica");
    doc.text(
      "Drops: every winners-bracket loss feeds the losers bracket. Lose in losers → eliminated. Win losers → grand final.",
      lx,
      y + 30,
      { width: 300 },
    );
  } else {
    const l1 = tripleL1RoundGameCounts(slots);
    const l2 = tripleL2RoundGameCounts(slots);
    let y = drawRoundLadder(doc, "L1 — one loss", l1, lx, 70, 150, "#c2410c");
    y = drawRoundLadder(doc, "L2 — two losses", l2, lx + 160, 70, 150, "#9a3412");
    y = Math.max(y, 70 + 16 + l1.length * 20) + 16;
    drawBox(doc, lx, y, 310, 22, "Grand Final · W champ vs L2 champ (1 game)", {
      fill: "#fef3c7",
      fontSize: 8,
    });
    doc.fontSize(7).fillColor("#64748b").font("Helvetica");
    doc.text(
      "Flow: W loss → L1; L1 loss → L2; L2 loss → out. Rematch-avoidance (optional) can re-pair open L1/L2 rounds.",
      lx,
      y + 30,
      { width: 310 },
    );
  }

  // First-round list footnote for large fields
  if (slots >= 32) {
    doc.fontSize(6.5).fillColor("#64748b").text(
      "Large field: winners boxes are compacted; first-round labels show S# seeds and BYEs. See index for totals.",
      28,
      575,
      { width: 400 },
    );
  }

  const first = firstRoundSides(teamCount);
  const played = playedFirstRoundGames(first);
  doc.fontSize(7).fillColor("#475569");
  doc.text(
    `First round: ${first.length} slots · ${played} played now · ${first.length - played} BYE advances`,
    28,
    560,
  );
}

async function writePdf(kind: "double" | "triple", fileName: string) {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, fileName);
  const doc = new PDFDocument({ autoFirstPage: false, info: { Title: fileName } });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  addCover(doc, kind);
  addIndexTable(doc, kind);
  for (let n = TEAM_MIN; n <= TEAM_MAX; n++) {
    addDetailPage(doc, kind, n);
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return outPath;
}

async function main() {
  const d = await writePdf("double", "double-elimination-6-to-50.pdf");
  const t = await writePdf("triple", "triple-elimination-6-to-50.pdf");
  console.log("Wrote:");
  console.log(" ", d);
  console.log(" ", t);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
