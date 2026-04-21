import Link from "next/link";
import { PageTitle } from "@/components/ui/PublicHeading";
import { tournamentPath } from "@/lib/tournament-public-path";

export default async function MorePage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tp = (s: string) => tournamentPath(tournamentSlug, s);

  const links = [
    { href: tp("locations"), label: "Locations", description: "Game Fields and Directions" },
    {
      href: tp("rules"),
      label: "Tournament Rules & Resources",
      description: "Rules for Royal & Classic and OBA resources",
    },
    { href: tp("social"), label: "Social", description: "Follow Baseball Milton" },
    { href: tp("settings"), label: "Settings", description: "App preferences" },
  ] as const;

  const cardClass =
    "group flex min-h-[48px] flex-col justify-center rounded-2xl border border-zinc-200 border-l-2 border-l-royal/90 bg-white px-4 py-3 shadow-sm transition-all active:scale-[0.99] hover:border-royal-200 hover:shadow-md";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>More</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">Quick links and resources.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={cardClass}>
              <span className="font-semibold text-zinc-900 group-hover:text-accent">{item.label}</span>
              <span className="text-xs text-zinc-500">{item.description}</span>
            </Link>
          </li>
        ))}
        <li className="sm:col-span-2">
          <Link href={tp("feedback")} className={cardClass}>
            <span className="font-semibold text-zinc-900 group-hover:text-accent">Feedback</span>
            <span className="text-xs text-zinc-500">Report a problem or share a suggestion</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
