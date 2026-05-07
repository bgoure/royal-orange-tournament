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

/** Checkbox `on` or segmented control `on` / `off`. */
const showHideField = z.preprocess((v) => v === "on" || v === true, z.boolean());

const optionalShortText = z.preprocess(
  emptyToUndef,
  z.string().max(160, "Subtext must be 160 characters or less").optional(),
);

export const tournamentBrandingFormSchema = z.object({
  pwaIcon192Url: optionalAssetUrl,
  pwaIcon512Url: optionalAssetUrl,
  gameSheetLogoRightUrl: optionalAssetUrl,
  pwaThemeColor: optionalHexColor,
  socialWebsiteUrl: optionalHttpUrl,
  socialFacebookUrl: optionalHttpUrl,
  socialInstagramUrl: optionalHttpUrl,
  socialXUrl: optionalHttpUrl,
  socialYoutubeUrl: optionalHttpUrl,
  socialEmail: optionalEmail,
  socialShowWebsite: showHideField,
  socialShowFacebook: showHideField,
  socialShowInstagram: showHideField,
  socialShowX: showHideField,
  socialShowYoutube: showHideField,
  socialShowEmail: showHideField,
  socialWebsiteSubtext: optionalShortText,
  socialFacebookSubtext: optionalShortText,
  socialInstagramSubtext: optionalShortText,
  socialXSubtext: optionalShortText,
  socialYoutubeSubtext: optionalShortText,
  socialEmailSubtext: optionalShortText,
});

export type TournamentBrandingFormInput = z.infer<typeof tournamentBrandingFormSchema>;
