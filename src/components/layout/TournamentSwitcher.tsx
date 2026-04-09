"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setSelectedTournamentSlug } from "@/app/actions/tournament";

type TournamentOption = {
  slug: string;
  name: string;
};

export function TournamentSwitcher({
  tournaments,
  currentSlug,
}: {
  tournaments: TournamentOption[];
  currentSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-zinc-500">
      <span className="sr-only">Tournament</span>
      <select
        className="max-w-full truncate rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60"
        disabled={pending}
        value={currentSlug}
        onChange={(e) => {
          const slug = e.target.value;
          startTransition(async () => {
            await setSelectedTournamentSlug(slug);
            router.refresh();
          });
        }}
      >
        {tournaments.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
