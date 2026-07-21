"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
  /** Absolute public URL e.g. https://royalorange.ca/fall-classic */
  publicUrl: string;
  /** Path only e.g. /fall-classic */
  publicPath: string;
};

export function ShareTournamentModal({
  open,
  onClose,
  tournamentName,
  publicUrl,
  publicPath,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [publicUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close share dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Share with parents</p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-zinc-900">
              {tournamentName}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Public link</p>
          <p className="mt-1 break-all font-mono text-sm text-zinc-900">{publicUrl}</p>
          <p className="mt-2 text-xs text-zinc-600">
            This is the link to share with parents (not the site home page). If you later change the URL slug under
            Tournament Admin, the old path keeps working via a redirect.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:flex-none"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 sm:flex-none"
          >
            Open public site
          </a>
        </div>

        <div className="mt-6 flex flex-col items-center border-t border-zinc-100 pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">QR code for gates / posters</p>
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <QRCodeSVG value={publicUrl} size={180} level="M" includeMargin bgColor="#ffffff" fgColor="#18181b" />
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Print or screenshot this QR. Scanning opens{" "}
            <span className="font-mono text-zinc-700">{publicPath}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
