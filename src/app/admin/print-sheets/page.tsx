import type { Metadata } from "next";
import {
  GameSheetTemplate,
  type GameSheetTemplateProps,
} from "@/components/admin/GameSheetTemplate";
import { PrintSheetsToolbar } from "@/components/admin/PrintSheetsToolbar";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { listGamesAdmin } from "@/lib/services/admin-games";
import { resolveGameSheetHeaderLogoUrl } from "@/lib/game-sheet-header-logo";
import { teamLogoUrl } from "@/lib/team-logo";
import { getTournamentForRequest } from "@/lib/tournament-context";
import "./print-sheets.css";

export const metadata: Metadata = {
  title: "Print game sheets",
};

const ASSOCIATION_NAME = "Milton Minor Baseball Association";

type GameRow = Awaited<ReturnType<typeof listGamesAdmin>>[number];
type SheetFields = Omit<
  GameSheetTemplateProps,
  "associationName" | "eventTitle" | "sheetHeaderRightLogoUrl"
>;

function chunkPairs<T>(items: T[]): [T, T | undefined][] {
  const out: [T, T | undefined][] = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push([items[i]!, items[i + 1]]);
  }
  return out;
}

/** Remove duplicated calendar year from start/end of tournament name when it matches `year`. */
function stripYearEdges(name: string, year: string): string {
  const y = year.trim();
  if (!y) return name.trim();
  let s = name.trim();
  s = s.replace(new RegExp(`^${y}\\s+`, "i"), "");
  s = s.replace(new RegExp(`\\s+${y}$`, "i"), "");
  return s.trim() || name.trim();
}

function buildEventTitle(tournamentName: string, tournamentStart: Date, timeZone: string) {
  const year = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" }).format(tournamentStart);
  const core = stripYearEdges(tournamentName, year);
  const parts = core.split("&");

  const lineClass =
    "text-xl font-bold leading-snug print:text-lg sm:text-2xl md:text-3xl";
  const yearClass = `text-royal ${lineClass}`;
  const ampClass = `text-royal ${lineClass}`;

  if (parts.length >= 2) {
    let left = parts[0]!.trim();
    let right = parts.slice(1).join("&").trim();
    left = left.replace(new RegExp(`\\s+${year}$`, "i"), "").trim();
    right = right.replace(new RegExp(`\\s+${year}$`, "i"), "").trim();
    const leftSep = left.endsWith("&") ? "" : " ";
    return (
      <span className="inline-block max-w-full break-words text-center">
        <span className={yearClass}>{year}</span>{" "}
        <span className={`text-royal ${lineClass}`}>
          {left}
          {leftSep}
        </span>
        <span className={ampClass}>&</span>{" "}
        <span className={`text-accent ${lineClass}`}>{right}</span>
      </span>
    );
  }

  return (
    <span className="inline-block max-w-full break-words text-center">
      <span className={yearClass}>{year}</span>{" "}
      <span className={`text-accent ${lineClass}`}>{core}</span>
    </span>
  );
}

function formatSheetDate(iso: Date, timeZone: string): string {
  try {
    const s = new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(iso);
    return s.replace(",", "").replace(/\s+/g, " ").trim();
  } catch {
    return iso.toISOString();
  }
}

function formatSheetTime(iso: Date, timeZone: string, schedulePlaceholder: boolean): string {
  if (schedulePlaceholder) return "TBD";
  try {
    const s = new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(iso);
    return s.replace(/\s*([AP]M)/i, (_, ap) => ap.toLowerCase());
  } catch {
    return iso.toISOString();
  }
}

function gameToSheetFields(
  g: GameRow,
  displayIndex: number,
  tournamentTimezone: string,
): SheetFields {
  const division = g.pool?.division.name ?? g.division?.name ?? "Division";
  const homeTeam = g.homeTeam?.name ?? "TBD";
  const awayTeam = g.awayTeam?.name ?? "TBD";
  const rawNum = g.gameNumber?.trim();
  const gameNumber = rawNum || String(displayIndex);

  const homeTeamLogoUrl = g.homeTeam?.logo
    ? teamLogoUrl(g.homeTeam.id, g.homeTeam.logo.updatedAt)
    : null;
  const awayTeamLogoUrl = g.awayTeam?.logo
    ? teamLogoUrl(g.awayTeam.id, g.awayTeam.logo.updatedAt)
    : null;

  return {
    gameNumber,
    homeTeam,
    awayTeam,
    homeTeamLogoUrl,
    awayTeamLogoUrl,
    division: division.toUpperCase(),
    date: formatSheetDate(g.scheduledAt, tournamentTimezone),
    time: formatSheetTime(g.scheduledAt, tournamentTimezone, g.schedulePlaceholder),
    diamondName: g.field.name,
  };
}

export default async function AdminPrintSheetsPage() {
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return <AdminNoTournamentPlaceholder />;
  }

  const games = await listGamesAdmin(tournament.id);
  const eventTitle = buildEventTitle(tournament.name, tournament.startDate, tournament.timezone);

  const rows: GameSheetTemplateProps[] = games.map((g, i) => ({
    associationName: ASSOCIATION_NAME,
    eventTitle,
    sheetHeaderRightLogoUrl: resolveGameSheetHeaderLogoUrl({
      tournamentId: tournament.id,
      gameSheetLogoRightUrl: tournament.gameSheetLogoRightUrl,
      gameSheetHeaderLogo: tournament.gameSheetHeaderLogo,
    }),
    ...gameToSheetFields(g, i + 1, tournament.timezone),
  }));

  const pairs = chunkPairs(rows);

  return (
    <div className="print-game-sheets-root -mx-4 max-w-none lg:-mx-8 print:mx-0 print:w-full print:max-w-full print:px-0">
      <PrintSheetsToolbar gameCount={games.length} />

      {games.length === 0 ? (
        <p className="text-sm text-zinc-600">No games on the schedule yet.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {pairs.map(([left, right], pageIndex) => (
            <div
              key={pageIndex}
              className="print-game-sheets-pair grid grid-cols-1 gap-8 md:grid-cols-2 print:grid-cols-2 print:break-after-page last:print:break-after-auto"
            >
              <div className="min-w-0 max-w-full">
                <GameSheetTemplate {...left} />
              </div>
              {right ? (
                <div className="min-w-0 max-w-full">
                  <GameSheetTemplate {...right} />
                </div>
              ) : (
                <div
                  className="hidden min-h-[20rem] rounded border border-dashed border-slate-200 bg-slate-50/80 md:block print:block print:min-h-0"
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
