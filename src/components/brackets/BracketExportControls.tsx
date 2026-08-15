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
  const iconBtn =
    "inline-flex size-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50";

  return (
    <div className="print:hidden">
      <div className="flex items-center gap-1.5">
        <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Download
        </span>
        <button
          type="button"
          disabled={busy}
          aria-label={busy && job.format === "png" ? "Preparing PNG" : "Download PNG"}
          title="Download PNG"
          onClick={() => {
            setError(null);
            setJob({ format: "png", nonce: Date.now() });
          }}
          className={iconBtn}
        >
          {busy && job.format === "png" ? (
            <span className="text-[10px] font-semibold">…</span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.25" fill="currentColor" stroke="none" />
              <path d="M21 16.5l-5.2-5.2a1.5 1.5 0 00-2.1 0L6 19" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label={busy && job.format === "pdf" ? "Preparing PDF" : "Download PDF"}
          title="Download PDF"
          onClick={() => {
            setError(null);
            setJob({ format: "pdf", nonce: Date.now() });
          }}
          className={iconBtn}
        >
          {busy && job.format === "pdf" ? (
            <span className="text-[10px] font-semibold">…</span>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" />
              <path d="M14 3v5h5" strokeLinejoin="round" />
              <text
                x="12"
                y="16.25"
                textAnchor="middle"
                fill="currentColor"
                stroke="none"
                fontSize="6.5"
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                PDF
              </text>
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-sm text-red-700" role="alert">
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
            createdAt={new Date()}
            onReady={onReady}
          />
        </>
      ) : null}
    </div>
  );
}
