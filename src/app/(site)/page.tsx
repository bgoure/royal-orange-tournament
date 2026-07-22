import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/MarketingHome";
import { listLiveTournamentsForDirectory } from "@/lib/tournament-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tournament Hub",
  description:
    "Live schedules, scores, and brackets for youth sports tournaments. Find your event or run one as an organizer.",
  openGraph: {
    title: "Tournament Hub",
    description: "Find live tournament schedules, scores, and brackets — or run your own event.",
  },
};

export default async function SiteRootPage() {
  const tournaments = await listLiveTournamentsForDirectory();
  return <MarketingHome tournaments={tournaments} />;
}
