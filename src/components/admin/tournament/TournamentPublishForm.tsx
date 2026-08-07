"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setTournamentPublished } from "@/app/admin/_actions/tournament-publish";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";

const btnPrimary =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

export function TournamentPublishForm({
  isPublished,
  tournamentName,
  publicSitePath,
  canManage,
}: {
  isPublished: boolean;
  tournamentName: string;
  publicSitePath: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    setTournamentPublished,
    undefined as ContentActionResult | undefined,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (!canManage) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Public site</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {isPublished ? "Published" : "Draft"} — you don’t have permission to change this.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Publish tournament</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {isPublished ? (
          <>
            <strong>{tournamentName}</strong> is live on the public site (
            <a href={publicSitePath} className="font-medium text-emerald-800 underline">
              {publicSitePath}
            </a>
            ). Unpublish to hide it again.
          </>
        ) : (
          <>
            <strong>{tournamentName}</strong> is a draft. Publish to show it on the public site
            (brackets still need their own publish toggle under Brackets if you want those visible).
          </>
        )}
      </p>

      {state && !state.ok ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.notice ? (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {state.notice}
        </p>
      ) : null}

      <form action={action} className="mt-4">
        <input type="hidden" name="published" value={isPublished ? "0" : "1"} />
        <button
          type="submit"
          disabled={pending}
          className={isPublished ? btnSecondary : btnPrimary}
        >
          {pending ? "Saving…" : isPublished ? "Unpublish" : "Publish tournament"}
        </button>
      </form>
    </section>
  );
}
