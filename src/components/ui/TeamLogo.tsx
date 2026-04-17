import { teamLogoUrl, type TeamWithPublicLogo } from "@/lib/team-logo";

/**
 * Small logo before a team name. Uses `<img>` (not `next/image`) so `/api/team-logo/...?v=...`
 * is not blocked by default `images.localPatterns` (query strings vs `search: ""`).
 */
export function TeamLogoMark({
  team,
  sizeClass = "h-8 w-8",
}: {
  team: TeamWithPublicLogo | null;
  /** Tailwind size classes (default 32×32). */
  sizeClass?: string;
}) {
  if (!team?.logo) return null;
  const src = teamLogoUrl(team.id, team.logo.updatedAt);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic API URL; see module comment
    <img
      key={src}
      src={src}
      alt=""
      className={`${sizeClass} shrink-0 rounded object-contain ring-1 ring-zinc-200/80`}
      loading="lazy"
    />
  );
}
