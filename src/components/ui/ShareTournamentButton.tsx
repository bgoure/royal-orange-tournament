"use client";

import { useCallback, useState } from "react";

type Props = {
  url: string;
  title: string;
  text?: string;
  className?: string;
  /** Compact icon-only control for the header */
  compact?: boolean;
};

export function ShareTournamentButton({
  url,
  title,
  text,
  className = "",
  compact = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  const share = useCallback(async () => {
    const payload = { title, text: text ?? title, url };
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(payload);
        return;
      }
    } catch (e) {
      // User cancelled share sheet — don't fall through to clipboard noise
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [title, text, url]);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void share()}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white ${className}`}
        aria-label={copied ? "Link copied" : "Share tournament"}
        title={copied ? "Link copied" : "Share"}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" strokeLinecap="round" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 ${className}`}
    >
      {copied ? "Link copied" : "Share tournament"}
    </button>
  );
}
