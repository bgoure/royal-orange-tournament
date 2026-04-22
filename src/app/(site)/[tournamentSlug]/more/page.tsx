import Link from "next/link";
import type { ReactNode } from "react";
import {
  MoreIconAnnouncements,
  MoreIconFeedback,
  MoreIconLocations,
  MoreIconRules,
  MoreIconSettings,
  MoreIconSocial,
} from "@/components/icons/MoreMenuIcons";
import { PageTitle } from "@/components/ui/PublicHeading";
import { tournamentPath } from "@/lib/tournament-public-path";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

export default async function MorePage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tp = (s: string) => tournamentPath(tournamentSlug, s);
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);

  const links: { href: string; label: string; description: string; icon: ReactNode }[] = [
    ...(tournament?.showPublicAnnouncements !== false
      ? [
          {
            href: tp("announcements"),
            label: "Announcements",
            description: "Current and past tournament updates",
            icon: <MoreIconAnnouncements />,
          },
        ]
      : []),
    {
      href: tp("locations"),
      label: "Locations",
      description: "Game Fields and Directions",
      icon: <MoreIconLocations />,
    },
    {
      href: tp("rules"),
      label: "Tournament Rules & Resources",
      description: "Know your Tournament!",
      icon: <MoreIconRules />,
    },
    { href: tp("social"), label: "Social", description: "Follow Us!", icon: <MoreIconSocial /> },
    { href: tp("settings"), label: "Settings", description: "Admin items", icon: <MoreIconSettings /> },
  ];

  const cardClass =
    "group flex min-h-[48px] items-start gap-3 rounded-2xl border border-zinc-200 border-l-2 border-l-royal/90 bg-white px-4 py-3 text-accent shadow-sm transition-all active:scale-[0.99] hover:border-royal-200 hover:shadow-md";

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
              <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold leading-tight">{item.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-zinc-500">{item.description}</span>
              </span>
            </Link>
          </li>
        ))}
        <li className="sm:col-span-2">
          <Link href={tp("feedback")} className={cardClass}>
            <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
              <MoreIconFeedback />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold leading-tight">Feedback</span>
              <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                Report something broken or just send us some love!
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
