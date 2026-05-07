"use client";

import { useActionState } from "react";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import {
  installDefaultPwaPlaceholderIcons,
  updateTournamentBranding,
  uploadGameSheetBrandingLogo,
  uploadPwaBrandingIcon,
} from "@/app/admin/_actions/tournament-branding";
import { SOCIAL_DEFAULT_HINTS } from "@/lib/tournament-social-public";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

function ErrorBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
      {state.error}
    </p>
  );
}

function SuccessBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state || !state.ok || !state.notice) return null;
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
      {state.notice}
    </p>
  );
}

const segClass = (on: boolean) =>
  `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors ${
    on ? "bg-emerald-600 text-white shadow-sm" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
  }`;

function SocialChannelFields({
  title,
  showName,
  urlName,
  urlType,
  subtextName,
  showChecked,
  urlValue,
  subtextValue,
  defaultHint,
  urlPlaceholder,
}: {
  title: string;
  showName: string;
  urlName: string;
  urlType: "url" | "email";
  subtextName: string;
  showChecked: boolean;
  urlValue: string | null;
  subtextValue: string | null;
  defaultHint: string;
  urlPlaceholder?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Public Social page</p>
      <div className="mt-2 flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-1" role="group" aria-label={`Show ${title}`}>
        <label className={`flex flex-1 cursor-pointer ${segClass(showChecked)}`}>
          <input type="radio" name={showName} value="on" defaultChecked={showChecked} className="sr-only" />
          Show
        </label>
        <label className={`flex flex-1 cursor-pointer ${segClass(!showChecked)}`}>
          <input type="radio" name={showName} value="off" defaultChecked={!showChecked} className="sr-only" />
          Hide
        </label>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <label htmlFor={urlName} className={`${labelClass} mt-2 block`}>
        {urlType === "email" ? "Address" : "URL"}
      </label>
      <input
        id={urlName}
        name={urlName}
        type={urlType}
        defaultValue={urlValue ?? ""}
        placeholder={urlPlaceholder}
        className={inputClass}
      />
      <label htmlFor={subtextName} className={`${labelClass} mt-2 block`}>
        Subtext (optional)
      </label>
      <input
        id={subtextName}
        name={subtextName}
        type="text"
        maxLength={160}
        defaultValue={subtextValue ?? ""}
        placeholder={defaultHint}
        className={inputClass}
      />
    </div>
  );
}

export type TournamentBrandingState = {
  pwaIcon192Url: string | null;
  pwaIcon512Url: string | null;
  gameSheetLogoLeftUrl: string | null;
  gameSheetLogoRightUrl: string | null;
  pwaThemeColor: string | null;
  socialWebsiteUrl: string | null;
  socialFacebookUrl: string | null;
  socialInstagramUrl: string | null;
  socialXUrl: string | null;
  socialYoutubeUrl: string | null;
  socialEmail: string | null;
  socialShowWebsite: boolean;
  socialShowFacebook: boolean;
  socialShowInstagram: boolean;
  socialShowX: boolean;
  socialShowYoutube: boolean;
  socialShowEmail: boolean;
  socialWebsiteSubtext: string | null;
  socialFacebookSubtext: string | null;
  socialInstagramSubtext: string | null;
  socialXSubtext: string | null;
  socialYoutubeSubtext: string | null;
  socialEmailSubtext: string | null;
};

export function TournamentBrandingForm({
  branding,
  canManage,
}: {
  branding: TournamentBrandingState;
  canManage: boolean;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    updateTournamentBranding,
    undefined as ContentActionResult | undefined,
  );
  const [upload192State, upload192Action, upload192Pending] = useActionState(
    uploadPwaBrandingIcon,
    undefined as ContentActionResult | undefined,
  );
  const [upload512State, upload512Action, upload512Pending] = useActionState(
    uploadPwaBrandingIcon,
    undefined as ContentActionResult | undefined,
  );
  const [uploadSheetLeftState, uploadSheetLeftAction, uploadSheetLeftPending] = useActionState(
    uploadGameSheetBrandingLogo,
    undefined as ContentActionResult | undefined,
  );
  const [uploadSheetRightState, uploadSheetRightAction, uploadSheetRightPending] = useActionState(
    uploadGameSheetBrandingLogo,
    undefined as ContentActionResult | undefined,
  );
  const [defaultsState, defaultsAction, defaultsPending] = useActionState(
    installDefaultPwaPlaceholderIcons,
    undefined as ContentActionResult | undefined,
  );

  if (!canManage) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">PWA &amp; social links</h2>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to edit branding.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
      <h2 className="text-sm font-semibold text-zinc-900">PWA &amp; social links</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Icons and links apply to the <strong>selected tournament</strong>. The install manifest uses these values.
        On Vercel and similar hosts, file uploads may fail (read-only disk) — use <strong>icon URLs</strong> or deploy
        assets to a CDN and paste paths here.
      </p>

      <div className="mt-4 space-y-4">
        <ErrorBanner state={saveState} />
        <SuccessBanner state={saveState} />
        <ErrorBanner state={upload192State} />
        <SuccessBanner state={upload192State} />
        <ErrorBanner state={upload512State} />
        <SuccessBanner state={upload512State} />
        <ErrorBanner state={uploadSheetLeftState} />
        <SuccessBanner state={uploadSheetLeftState} />
        <ErrorBanner state={uploadSheetRightState} />
        <SuccessBanner state={uploadSheetRightState} />
        <ErrorBanner state={defaultsState} />
        <SuccessBanner state={defaultsState} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-zinc-200 pb-4">
        <form action={defaultsAction}>
          <button type="submit" disabled={defaultsPending} className={btnSecondary}>
            {defaultsPending ? "Copying…" : "Use placeholder PNGs in /branding/{slug}"}
          </button>
        </form>
        <p className="w-full text-[11px] text-zinc-500">
          Copies <code className="rounded bg-zinc-100 px-1">public/icon-192.png</code> and{" "}
          <code className="rounded bg-zinc-100 px-1">icon-512.png</code> into this tournament’s folder and sets DB
          URLs. Commit generated files if you rely on git deploy.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-zinc-800">Upload 192×192</h3>
          <form action={upload192Action} encType="multipart/form-data" className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="size" value="192" />
            <input name="file" type="file" accept="image/png,image/jpeg" className="text-sm" />
            <button type="submit" disabled={upload192Pending} className={btnSecondary}>
              {upload192Pending ? "Uploading…" : "Upload"}
            </button>
          </form>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-zinc-800">Upload 512×512</h3>
          <form action={upload512Action} encType="multipart/form-data" className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="size" value="512" />
            <input name="file" type="file" accept="image/png,image/jpeg" className="text-sm" />
            <button type="submit" disabled={upload512Pending} className={btnSecondary}>
              {upload512Pending ? "Uploading…" : "Upload"}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-xs font-semibold text-zinc-900">Print · game sheet header logos</h3>
        <p className="mt-1 text-[11px] text-zinc-600">
          Left and right images appear on <strong>Print game sheets</strong> (schedule cards). Same upload
          constraints as PWA icons — on read-only hosts, paste a URL in the fields below and save.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-100 p-3">
            <p className="text-[11px] font-semibold text-zinc-800">Left (e.g. tournament mark)</p>
            <form action={uploadSheetLeftAction} encType="multipart/form-data" className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="slot" value="left" />
              <input name="file" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
              <button type="submit" disabled={uploadSheetLeftPending} className={btnSecondary}>
                {uploadSheetLeftPending ? "Uploading…" : "Upload left"}
              </button>
            </form>
            {branding.gameSheetLogoLeftUrl ? (
              <p className="mt-2 truncate text-[11px] text-zinc-500" title={branding.gameSheetLogoLeftUrl}>
                Current: {branding.gameSheetLogoLeftUrl}
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-zinc-100 p-3">
            <p className="text-[11px] font-semibold text-zinc-800">Right (e.g. division / league mark)</p>
            <form action={uploadSheetRightAction} encType="multipart/form-data" className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="slot" value="right" />
              <input name="file" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
              <button type="submit" disabled={uploadSheetRightPending} className={btnSecondary}>
                {uploadSheetRightPending ? "Uploading…" : "Upload right"}
              </button>
            </form>
            {branding.gameSheetLogoRightUrl ? (
              <p className="mt-2 truncate text-[11px] text-zinc-500" title={branding.gameSheetLogoRightUrl}>
                Current: {branding.gameSheetLogoRightUrl}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <form action={saveAction} className="mt-6 flex max-w-3xl flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pwaIcon192Url" className={labelClass}>
              PWA icon 192 URL / path
            </label>
            <input
              id="pwaIcon192Url"
              name="pwaIcon192Url"
              type="text"
              defaultValue={branding.pwaIcon192Url ?? ""}
              placeholder="/branding/my-slug/icon-192.png"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pwaIcon512Url" className={labelClass}>
              PWA icon 512 URL / path
            </label>
            <input
              id="pwaIcon512Url"
              name="pwaIcon512Url"
              type="text"
              defaultValue={branding.pwaIcon512Url ?? ""}
              placeholder="/branding/my-slug/icon-512.png"
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="gameSheetLogoLeftUrl" className={labelClass}>
              Game sheet left logo URL / path
            </label>
            <input
              id="gameSheetLogoLeftUrl"
              name="gameSheetLogoLeftUrl"
              type="text"
              defaultValue={branding.gameSheetLogoLeftUrl ?? ""}
              placeholder="/branding/my-slug/game-sheet-left.png"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="gameSheetLogoRightUrl" className={labelClass}>
              Game sheet right logo URL / path
            </label>
            <input
              id="gameSheetLogoRightUrl"
              name="gameSheetLogoRightUrl"
              type="text"
              defaultValue={branding.gameSheetLogoRightUrl ?? ""}
              placeholder="/branding/my-slug/game-sheet-right.png"
              className={inputClass}
            />
          </div>
        </div>
        <div className="max-w-xs">
          <label htmlFor="pwaThemeColor" className={labelClass}>
            Theme color (manifest + status bar)
          </label>
          <input
            id="pwaThemeColor"
            name="pwaThemeColor"
            type="text"
            defaultValue={branding.pwaThemeColor ?? ""}
            placeholder="#1a1a2e"
            className={inputClass}
          />
        </div>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Social (public page)</h3>
        <p className="text-xs text-zinc-600">
          Use <strong>Hide</strong> to suppress a card even when a URL is saved. Subtext appears under the channel name;
          leave blank to use the default line shown in the placeholder.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <SocialChannelFields
            title="Website"
            showName="socialShowWebsite"
            urlName="socialWebsiteUrl"
            urlType="url"
            subtextName="socialWebsiteSubtext"
            showChecked={branding.socialShowWebsite}
            urlValue={branding.socialWebsiteUrl}
            subtextValue={branding.socialWebsiteSubtext}
            defaultHint={SOCIAL_DEFAULT_HINTS.website}
          />
          <SocialChannelFields
            title="Facebook"
            showName="socialShowFacebook"
            urlName="socialFacebookUrl"
            urlType="url"
            subtextName="socialFacebookSubtext"
            showChecked={branding.socialShowFacebook}
            urlValue={branding.socialFacebookUrl}
            subtextValue={branding.socialFacebookSubtext}
            defaultHint={SOCIAL_DEFAULT_HINTS.facebook}
          />
          <SocialChannelFields
            title="Instagram"
            showName="socialShowInstagram"
            urlName="socialInstagramUrl"
            urlType="url"
            subtextName="socialInstagramSubtext"
            showChecked={branding.socialShowInstagram}
            urlValue={branding.socialInstagramUrl}
            subtextValue={branding.socialInstagramSubtext}
            defaultHint={SOCIAL_DEFAULT_HINTS.instagram}
          />
          <SocialChannelFields
            title="X (Twitter)"
            showName="socialShowX"
            urlName="socialXUrl"
            urlType="url"
            subtextName="socialXSubtext"
            showChecked={branding.socialShowX}
            urlValue={branding.socialXUrl}
            subtextValue={branding.socialXSubtext}
            defaultHint={SOCIAL_DEFAULT_HINTS.x}
          />
          <SocialChannelFields
            title="YouTube"
            showName="socialShowYoutube"
            urlName="socialYoutubeUrl"
            urlType="url"
            subtextName="socialYoutubeSubtext"
            showChecked={branding.socialShowYoutube}
            urlValue={branding.socialYoutubeUrl}
            subtextValue={branding.socialYoutubeSubtext}
            defaultHint={SOCIAL_DEFAULT_HINTS.youtube}
          />
          <SocialChannelFields
            title="Contact email"
            showName="socialShowEmail"
            urlName="socialEmail"
            urlType="email"
            subtextName="socialEmailSubtext"
            showChecked={branding.socialShowEmail}
            urlValue={branding.socialEmail}
            subtextValue={branding.socialEmailSubtext}
            defaultHint={SOCIAL_DEFAULT_HINTS.email}
            urlPlaceholder="info@example.com"
          />
        </div>

        <button type="submit" disabled={savePending} className={`${btnPrimary} w-fit`}>
          {savePending ? "Saving…" : "Save PWA & social"}
        </button>
      </form>
    </section>
  );
}
