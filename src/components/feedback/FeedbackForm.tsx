"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  submitFeedbackAction,
  type FeedbackActionState,
} from "@/lib/actions/public-feedback";

const initial: FeedbackActionState = { ok: false };

export function FeedbackForm({
  tournamentSlug,
  sourcePath,
}: {
  tournamentSlug: string;
  sourcePath: string;
}) {
  const [state, formAction, pending] = useActionState(submitFeedbackAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state.ok ? undefined : state.fieldErrors;
  const formError = state.ok ? undefined : state.error;

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <div className="flex flex-col gap-4">
      {state.ok ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Thanks — your feedback was saved. If you left an email, we may follow up.
        </div>
      ) : null}

      {formError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</p>
      ) : null}

      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
        <input type="hidden" name="sourcePath" value={sourcePath} />
        <input
          type="text"
          name="_gotcha"
          tabIndex={-1}
          autoComplete="off"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden
        />

        <div>
          <label htmlFor="feedback-message" className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Your feedback
          </label>
          <textarea
            id="feedback-message"
            name="message"
            required
            rows={6}
            maxLength={8000}
            placeholder="What worked well, what didn’t, or what you’d like to see…"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-royal focus:ring-2 focus:ring-royal/20"
          />
          {fieldErrors?.message ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.message}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="feedback-email" className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Email <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="feedback-email"
            name="contactEmail"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-royal focus:ring-2 focus:ring-royal/20"
          />
          {fieldErrors?.contactEmail ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.contactEmail}</p>
          ) : null}
        </div>

        <p className="text-xs leading-relaxed text-zinc-500">
          Submissions are stored for the tournament organizers. Don’t include passwords or sensitive personal data.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-royal-800 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </div>
  );
}
