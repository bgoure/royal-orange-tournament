import { z } from "zod";

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalHttpUrl = z.preprocess(
  emptyToUndef,
  z.union([z.string().url(), z.undefined()]).optional(),
);

/** Full URL or site-relative path (e.g. /branding/my-slug/icon-192.png). */
const optionalAssetUrl = z.preprocess(
  emptyToUndef,
  z
    .string()
    .max(2000)
    .refine(
      (s) => /^https?:\/\//i.test(s) || (s.startsWith("/") && !s.includes("..")),
      "Use https URL or a path starting with /",
    )
    .optional(),
);

const optionalEmail = z.preprocess(
  emptyToUndef,
  z.union([z.string().email(), z.undefined()]).optional(),
);

const optionalHexColor = z.preprocess(emptyToUndef, z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use #RRGGBB").optional());

export const tournamentBrandingFormSchema = z.object({
  pwaIcon192Url: optionalAssetUrl,
  pwaIcon512Url: optionalAssetUrl,
  pwaThemeColor: optionalHexColor,
  socialWebsiteUrl: optionalHttpUrl,
  socialFacebookUrl: optionalHttpUrl,
  socialInstagramUrl: optionalHttpUrl,
  socialXUrl: optionalHttpUrl,
  socialYoutubeUrl: optionalHttpUrl,
  socialEmail: optionalEmail,
});

export type TournamentBrandingFormInput = z.infer<typeof tournamentBrandingFormSchema>;
