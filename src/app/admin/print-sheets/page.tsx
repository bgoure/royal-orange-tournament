import type { Metadata } from "next";
import {
  GameSheetTemplate,
  type GameSheetTemplateProps,
} from "@/components/admin/GameSheetTemplate";
import { PrintSheetsToolbar } from "@/components/admin/PrintSheetsToolbar";
import { AdminNoTournamentPlaceholder } from "@/components/admin/AdminNoTournamentPlaceholder";
import { formatFieldWithLocation } from "@/lib/field-display";
import { listGamesAdmin } from "@/lib/services/admin-games";
import { getTournamentForRequest } from "@/lib/tournament-context";
import "./print-sheets.css";

export const metadata: Metadata = {
  title: "Print game sheets",
};

const ASSOCIATION_NAME = "Milton Minor Baseball Association";

type GameRow = Awaited<ReturnType<typeof listGamesAdmin>>[number];
type SheetFields = Omit<GameSheetTemplateProps, "associationName" | "eventTitle">;

function chunkPairs<T>(items: T[]): [T, T | undefined][] {
  const out: [T, T | undefined][] = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push([items[i]!, items[i + 1]]);
  }
  return out;
}

function buildEventTitle(tournamentName: string, tournamentStart: Date, timeZone: string) {
  const year = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" }).format(tournamentStart);
  const parts = tournamentName.split("&");
  if (parts.length >= 2) {
    const left = parts[0]!.trim();
    const right = parts.slice(1).join("&").trim();
    return (
      <>
        <span className="text-royal">{year}</span>{" "}
        <span className="text-royal">
          {left}
          {left.endsWith("&") ? "" : " &"}
        </span>{" "}
        <span className="text-accent">{right}</span>
      </>
    );
  }
  return (
    <>
      <span className="text-royal">{year}</span> <span className="text-royal">{tournamentName}</span>
    </>
  );
}

function formatSheetDate(iso: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(iso);
  } catch {
    return iso.toISOString();
  }
}

function formatSheetTime(iso: Date, timeZone: string, schedulePlaceholder: boolean): string {
  if (schedulePlaceholder) return "TBD";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(iso);
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

  return {
    gameNumber,
    homeTeam,
    awayTeam,
    division: division.toUpperCase(),
    date: formatSheetDate(g.scheduledAt, tournamentTimezone),
    time: formatSheetTime(g.scheduledAt, tournamentTimezone, g.schedulePlaceholder),
    location: formatFieldWithLocation(g.field.name, g.field.location.name),
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
    ...gameToSheetFields(g, i + 1, tournament.timezone),
  }));

  const pairs = chunkPairs(rows);

  return (
    <div className="print-game-sheets-root -mx-4 max-w-none lg:-mx-8">
      <PrintSheetsToolbar gameCount={games.length} />

      {games.length === 0 ? (
        <p className="text-sm text-zinc-600">No games on the schedule yet.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {pairs.map(([left, right], pageIndex) => (
            <div
              key={pageIndex}
              className="grid grid-cols-1 gap-8 md:grid-cols-2 print:grid-cols-2 print:gap-6 print:break-after-page last:print:break-after-auto"
            >
              <GameSheetTemplate {...left} />
              {right ? (
                <GameSheetTemplate {...right} />
              ) : (
                <div
                  className="hidden min-h-[28rem] rounded border border-dashed border-slate-200 bg-slate-50/80 md:block print:block"
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
