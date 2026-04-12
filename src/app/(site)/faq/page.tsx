import Link from "next/link";
import { listFaqItems } from "@/lib/services/content";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function FaqPage() {
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return <p className="text-sm text-zinc-500">No tournament selected.</p>;
  }

  const faqs = await listFaqItems(tournament.id);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">FAQ</h1>
        <p className="text-sm text-zinc-600">Answers for {tournament.name}.</p>
        <p className="mt-2 text-sm">
          <Link href="/locations" className="font-medium text-royal-light underline-offset-2 hover:underline">
            Venues &amp; tournament headquarters →
          </Link>
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Questions</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {faqs.length === 0 ? (
            <li className="text-sm text-zinc-500">No FAQ entries yet.</li>
          ) : (
            faqs.map((f) => (
              <li key={f.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <p className="font-medium text-zinc-900">{f.question}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{f.answer}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
