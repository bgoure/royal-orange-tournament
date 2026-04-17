import Image from "next/image";
import { teamLogoUrl, type TeamWithPublicLogo } from "@/lib/team-logo";

export function TeamLogoMark({
  team,
  sizeClass = "h-8 w-8",
}: {
  team: TeamWithPublicLogo | null;
  /** Tailwind size classes (default 32×32). */
  sizeClass?: string;
}) {
  if (!team?.logo) return null;
  return (
    <Image
      src={teamLogoUrl(team.id, team.logo.updatedAt)}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={`${sizeClass} shrink-0 rounded object-contain ring-1 ring-zinc-200/80`}
    />
  );
}
