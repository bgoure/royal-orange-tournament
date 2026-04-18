import Link from "next/link";
import type { Tournament } from "@prisma/client";
import { PageTitle } from "@/components/ui/PublicHeading";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";

const FALLBACK = {
  website: "https://www.baseballontario.com/",
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  x: "https://twitter.com/",
  youtube: "https://www.youtube.com/",
  email: "mailto:info@example.com",
} as const;

const SOCIAL_DEFS = [
  {
    key: "website" as const,
    label: "Website",
    hint: "League or association site",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    hint: "Community updates",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: "instagram" as const,
    label: "Instagram",
    hint: "Photos & stories",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    key: "x" as const,
    label: "X",
    hint: "News & highlights",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "youtube" as const,
    label: "YouTube",
    hint: "Video highlights",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    key: "email" as const,
    label: "Email",
    hint: "Contact the league",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6" aria-hidden>
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
] as const;

function hrefFor(t: Tournament | null, key: (typeof SOCIAL_DEFS)[number]["key"]): string {
  if (!t) return FALLBACK[key === "email" ? "email" : key];
  const raw =
    key === "website"
      ? t.socialWebsiteUrl
      : key === "facebook"
        ? t.socialFacebookUrl
        : key === "instagram"
          ? t.socialInstagramUrl
          : key === "x"
            ? t.socialXUrl
            : key === "youtube"
              ? t.socialYoutubeUrl
              : t.socialEmail;
  const s = raw?.trim();
  if (!s) return FALLBACK[key === "email" ? "email" : key];
  if (key === "email") {
    if (s.startsWith("mailto:")) return s;
    return `mailto:${s}`;
  }
  return s;
}

export default async function SocialPage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Social</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">
          Links for {tournament?.name ?? "this tournament"}. Directors can edit them under{" "}
          <span className="font-medium text-zinc-800">Admin → Tournament HQ</span>.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_DEFS.map((s) => {
          const href = hrefFor(tournament, s.key);
          const external = s.key !== "email";
          return (
            <li key={s.key}>
              <Link
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="group flex min-h-[48px] items-start gap-3 rounded-2xl border border-zinc-200 border-l-royal bg-white p-4 shadow-sm transition-all hover:border-royal-200 hover:shadow-md active:scale-[0.99]"
              >
                <span className="mt-0.5 text-royal">{s.icon}</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-zinc-900 group-hover:text-accent">{s.label}</span>
                  <span className="block text-xs text-zinc-500">{s.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
