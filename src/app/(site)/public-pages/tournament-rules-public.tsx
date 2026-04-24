import type { Tournament } from "@prisma/client";
import { RoyalOrangeClassicRules } from "@/components/content/RoyalOrangeClassicRules";
import { publicGlassCard2xl } from "@/lib/public-glass-card";
import { PageTitle, SectionTitle } from "@/components/ui/PublicHeading";
import { listFaqItems } from "@/lib/services/content";

export async function TournamentRulesPublic({ tournament }: { tournament: Tournament }) {
  const faqItems = tournament.showPublicFaqSection ? await listFaqItems(tournament.id) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Rules and Resources</PageTitle>
      </div>
      <RoyalOrangeClassicRules tournamentName={tournament.name} />
      {faqItems.length > 0 ? (
        <section id="faq" className="scroll-mt-24 border-t border-zinc-200 pt-6">
          <SectionTitle className="mb-4">FAQ</SectionTitle>
          <dl className="flex flex-col gap-4">
            {faqItems.map((item) => (
              <div key={item.id} className={`p-4 ${publicGlassCard2xl}`}>
                <dt className="font-semibold text-zinc-900">{item.question}</dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
