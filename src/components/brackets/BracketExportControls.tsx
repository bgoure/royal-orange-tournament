"use client";

import { useCallback, useId, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { domToPng } from "modern-screenshot";
import { BracketExportSurface } from "@/components/brackets/BracketExportSurface";
import type { BracketWith, GameRow } from "@/components/brackets/bracket-types";
import {
  BRACKET_EXPORT_PAGE_IN_H,
  BRACKET_EXPORT_PAGE_IN_W,
  BRACKET_EXPORT_PAGE_PX_H,
  BRACKET_EXPORT_PAGE_PX_W,
  bracketExportBasename,
  downloadDataUrl,
} from "@/lib/brackets/bracket-export";

type Format = "png" | "pdf";

type Job = { format: Format; nonce: number };

export function BracketExportControls({
  brackets,
  consolationGames = [],
  tournamentName,
  tournamentShortLabel,
  divisionName,
  headerLogoUrl,
  tournamentTimezone,
  showHomeAway = true,
}: {
  brackets: BracketWith[];
  consolationGames?: GameRow[];
  tournamentName: string;
  tournamentShortLabel?: string | null;
  divisionName?: string | null;
  headerLogoUrl?: string | null;
  tournamentTimezone?: string | null;
  showHomeAway?: boolean;
}) {
  const liveId = useId();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef(job);
  jobRef.current = job;

  const onReady = useCallback(
    async (pageEl: HTMLElement) => {
      const format = jobRef.current?.format;
      if (!format) return;
      try {
        const dataUrl = await domToPng(pageEl, {
          width: BRACKET_EXPORT_PAGE_PX_W,
          height: BRACKET_EXPORT_PAGE_PX_H,
          backgroundColor: "#ffffff",
          scale: 1,
          style: { colorScheme: "only light" },
        });
        const base = bracketExportBasename({ tournamentName, divisionName });
        if (format === "png") {
          downloadDataUrl(dataUrl, `${base}.png`);
        } else {
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "in",
            format: "letter",
            compress: true,
          });
          pdf.addImage(dataUrl, "PNG", 0, 0, BRACKET_EXPORT_PAGE_IN_W, BRACKET_EXPORT_PAGE_IN_H);
          pdf.save(`${base}.pdf`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not generate the bracket image.";
        setError(msg);
      } finally {
        setJob(null);
      }
    },
    [tournamentName, divisionName],
  );

  if (brackets.length === 0) return null;

  const busy = job != null;

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Save bracket
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            setJob({ format: "png", nonce: Date.now() });
          }}
          className="inline-flex min-h-10 items-center rounded-lg border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur-md hover:bg-white disabled:opacity-50"
        >
          {busy && job.format === "png" ? "Preparing…" : "PNG"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            setJob({ format: "pdf", nonce: Date.now() });
          }}
          className="inline-flex min-h-10 items-center rounded-lg border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur-md hover:bg-white disabled:opacity-50"
        >
          {busy && job.format === "pdf" ? "Preparing…" : "PDF"}
        </button>
        <span className="text-xs text-zinc-500">Landscape, one page</span>
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {busy ? (
        <>
          <p
            className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
            aria-live="polite"
          >
            Building landscape {job.format.toUpperCase()}…
          </p>
          <BracketExportSurface
            key={`${liveId}-${job.nonce}`}
            brackets={brackets}
            consolationGames={consolationGames}
            tournamentName={tournamentName}
            tournamentShortLabel={tournamentShortLabel}
            divisionName={divisionName}
            headerLogoUrl={headerLogoUrl}
            tournamentTimezone={tournamentTimezone}
            showHomeAway={showHomeAway}
            onReady={onReady}
          />
        </>
      ) : null}
    </div>
  );
}
