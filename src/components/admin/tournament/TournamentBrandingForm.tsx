"use client";

import { useActionState } from "react";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import {
  installDefaultPwaPlaceholderIcons,
  updateTournamentBranding,
  uploadPwaBrandingIcon,
} from "@/app/admin/_actions/tournament-branding";

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

export type TournamentBrandingState = {
  pwaIcon192Url: string | null;
  pwaIcon512Url: string | null;
  pwaThemeColor: string | null;
  socialWebsiteUrl: string | null;
  socialFacebookUrl: string | null;
  socialInstagramUrl: string | null;
  socialXUrl: string | null;
  socialYoutubeUrl: string | null;
  socialEmail: string | null;
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="socialWebsiteUrl" className={labelClass}>
              Website
            </label>
            <input
              id="socialWebsiteUrl"
              name="socialWebsiteUrl"
              type="url"
              defaultValue={branding.socialWebsiteUrl ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="socialFacebookUrl" className={labelClass}>
              Facebook
            </label>
            <input
              id="socialFacebookUrl"
              name="socialFacebookUrl"
              type="url"
              defaultValue={branding.socialFacebookUrl ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="socialInstagramUrl" className={labelClass}>
              Instagram
            </label>
            <input
              id="socialInstagramUrl"
              name="socialInstagramUrl"
              type="url"
              defaultValue={branding.socialInstagramUrl ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="socialXUrl" className={labelClass}>
              X (Twitter)
            </label>
            <input
              id="socialXUrl"
              name="socialXUrl"
              type="url"
              defaultValue={branding.socialXUrl ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="socialYoutubeUrl" className={labelClass}>
              YouTube
            </label>
            <input
              id="socialYoutubeUrl"
              name="socialYoutubeUrl"
              type="url"
              defaultValue={branding.socialYoutubeUrl ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="socialEmail" className={labelClass}>
              Contact email
            </label>
            <input
              id="socialEmail"
              name="socialEmail"
              type="email"
              defaultValue={branding.socialEmail ?? ""}
              placeholder="info@example.com"
              className={inputClass}
            />
          </div>
        </div>

        <button type="submit" disabled={savePending} className={`${btnPrimary} w-fit`}>
          {savePending ? "Saving…" : "Save URLs & theme"}
        </button>
      </form>
    </section>
  );
}
