/**
 * One-time (idempotent) repair of OBA 5- and 6-team bracket round groupings.
 *
 * Public bracket reads are write-free, so brackets created before the workbook round layout
 * need this repair run explicitly — either from Admin → Brackets → Maintenance, or here.
 *
 * Usage:
 *   npx tsx scripts/repair-oba-round-groupings.ts              # every tournament
 *   npx tsx scripts/repair-oba-round-groupings.ts <slug|id> …  # only these tournaments
 *   npx tsx scripts/repair-oba-round-groupings.ts --dry-run    # report what would change
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const PRESET_KEYS = ["oba_de_5", "oba_de_6"];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const selectors = args.filter((a) => !a.startsWith("--"));

  const prisma = new PrismaClient();
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        brackets: { some: { presetKey: { in: PRESET_KEYS } } },
        ...(selectors.length > 0 ? { OR: [{ id: { in: selectors } }, { slug: { in: selectors } }] } : {}),
      },
      select: { id: true, slug: true, name: true },
      orderBy: { startDate: "asc" },
    });

    if (tournaments.length === 0) {
      console.log("No tournaments with oba_de_5 / oba_de_6 brackets matched.");
      return;
    }

    // Imported lazily so --dry-run never pulls in the write path.
    const repair = dryRun
      ? null
      : (await import("../src/lib/services/oba-de-bracket-build")).repairObaRoundGroupingsForTournament;

    for (const t of tournaments) {
      const affected = await prisma.bracket.count({
        where: { tournamentId: t.id, presetKey: { in: PRESET_KEYS } },
      });
      if (!repair) {
        console.log(`[dry-run] ${t.slug} (${t.name}): would check ${affected} bracket(s)`);
        continue;
      }
      await repair(t.id);
      console.log(`${t.slug} (${t.name}): checked ${affected} bracket(s)`);
    }

    console.log(`Done — ${tournaments.length} tournament(s) processed${dryRun ? " (dry run)" : ""}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
