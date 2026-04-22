import type { Tournament } from "@prisma/client";

export const SOCIAL_CHANNEL_KEYS = [
  "website",
  "facebook",
  "instagram",
  "x",
  "youtube",
  "email",
] as const;

export type SocialChannelKey = (typeof SOCIAL_CHANNEL_KEYS)[number];

export const SOCIAL_DEFAULT_HINTS: Record<SocialChannelKey, string> = {
  website: "League or association site",
  facebook: "Community updates",
  instagram: "Photos & stories",
  x: "News & highlights",
  youtube: "Video highlights",
  email: "Contact the league",
};

function rawLinkValue(t: Tournament, key: SocialChannelKey): string | null {
  const s =
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
  const v = s?.trim();
  return v && v.length > 0 ? v : null;
}

function showChannel(t: Tournament, key: SocialChannelKey): boolean {
  switch (key) {
    case "website":
      return t.socialShowWebsite;
    case "facebook":
      return t.socialShowFacebook;
    case "instagram":
      return t.socialShowInstagram;
    case "x":
      return t.socialShowX;
    case "youtube":
      return t.socialShowYoutube;
    case "email":
      return t.socialShowEmail;
    default:
      return true;
  }
}

function customSubtext(t: Tournament, key: SocialChannelKey): string | null {
  const s =
    key === "website"
      ? t.socialWebsiteSubtext
      : key === "facebook"
        ? t.socialFacebookSubtext
        : key === "instagram"
          ? t.socialInstagramSubtext
          : key === "x"
            ? t.socialXSubtext
            : key === "youtube"
              ? t.socialYoutubeSubtext
              : t.socialEmailSubtext;
  const v = s?.trim();
  return v && v.length > 0 ? v : null;
}

/** `mailto:` or https URL; null when the card should not appear on the public Social page. */
export function publicSocialHref(t: Tournament, key: SocialChannelKey): string | null {
  if (!showChannel(t, key)) return null;
  const raw = rawLinkValue(t, key);
  if (!raw) return null;
  if (key === "email") {
    if (raw.startsWith("mailto:")) return raw;
    return `mailto:${raw}`;
  }
  return raw;
}

export function publicSocialSubtext(t: Tournament, key: SocialChannelKey): string {
  return customSubtext(t, key) ?? SOCIAL_DEFAULT_HINTS[key];
}
