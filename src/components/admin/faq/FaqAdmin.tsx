"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FaqItem } from "@prisma/client";
import type { ContentActionResult } from "@/app/admin/_actions/content-shared";
import { createFaqItem, deleteFaqItem, moveFaqItem, updateFaqItem } from "@/app/admin/_actions/faq";
import { updateShowPublicFaqSection } from "@/app/admin/_actions/tournament-public-sections";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100";
const btnGhost = "rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50";

const segBtn = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active ? "bg-emerald-600 text-white shadow-sm" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
  }`;

function ErrorBanner({ state }: { state: ContentActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
      {state.error}
    </p>
  );
}

export function FaqAdmin({
  items,
  tournamentName,
  publicSitePath,
  canManage,
  showPublicFaqSection,
}: {
  items: FaqItem[];
  tournamentName: string;
  /** Canonical public site base (`/{slug}` live or `/{folder}/{slug}` when archived). */
  publicSitePath: string;
  canManage: boolean;
  showPublicFaqSection: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createFaqItem,
    undefined as ContentActionResult | undefined,
  );
  const [faqVisibilityState, faqVisibilityAction, faqVisibilityPending] = useActionState(
    updateShowPublicFaqSection,
    undefined as ContentActionResult | undefined,
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">FAQ</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/locations" className={btnSecondary}>
            Locations
          </Link>
          <Link href="/admin/tournament-settings" className={btnSecondary}>
            Tournament Admin
          </Link>
          <Link href={tournamentPathFromBase(publicSitePath, "rules")} className={btnSecondary}>
            View public rules ↗
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Public site — FAQ section</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Published entries appear on the <strong>Rules &amp; Resources</strong> page when the section is shown. Hiding
          removes the whole block (even if you have questions saved).
        </p>
        <div className="mt-2">
          <ActionMessage state={faqVisibilityState} />
        </div>
        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={faqVisibilityAction} className="inline">
              <input type="hidden" name="showPublicFaqSection" value="true" />
              <button
                type="submit"
                disabled={faqVisibilityPending || showPublicFaqSection}
                className={segBtn(showPublicFaqSection)}
              >
                Show section
              </button>
            </form>
            <form action={faqVisibilityAction} className="inline">
              <input type="hidden" name="showPublicFaqSection" value="false" />
              <button
                type="submit"
                disabled={faqVisibilityPending || !showPublicFaqSection}
                className={segBtn(!showPublicFaqSection)}
              >
                Hide section
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Current: {showPublicFaqSection ? "Visible" : "Hidden"}</p>
        )}
      </section>

      {!canManage ? (
        <p className="text-sm text-zinc-600">You don’t have permission to manage FAQ content.</p>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">New question</h2>
            <ErrorBanner state={createState} />
            <form action={createAction} className="mt-4 flex max-w-2xl flex-col gap-4">
              <div>
                <label htmlFor="faq-q" className={labelClass}>
                  Question
                </label>
                <input id="faq-q" name="question" required className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label htmlFor="faq-a" className={labelClass}>
                  Answer
                </label>
                <textarea id="faq-a" name="answer" required rows={4} className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label htmlFor="faq-order" className={labelClass}>
                  Sort order (optional)
                </label>
                <input
                  id="faq-order"
                  name="sortOrder"
                  type="number"
                  className={`${formClass} mt-1 w-full max-w-xs`}
                  placeholder="Append to end if empty"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input type="checkbox" name="published" defaultChecked className="rounded border-zinc-300" />
                Published on public site
              </label>
              <button type="submit" disabled={createPending} className={`${btnPrimary} w-fit`}>
                {createPending ? "Saving…" : "Add FAQ"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">Existing</h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No entries yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-6">
                {items.map((f, i) => (
                  <FaqEditRow key={f.id} item={f} index={i} total={items.length} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FaqEditRow({ item: f, index, total }: { item: FaqItem; index: number; total: number }) {
  const [updState, updAction, updPending] = useActionState(
    updateFaqItem,
    undefined as ContentActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteFaqItem,
    undefined as ContentActionResult | undefined,
  );
  const [upState, upAction, upPending] = useActionState(moveFaqItem, undefined as ContentActionResult | undefined);
  const [downState, downAction, downPending] = useActionState(
    moveFaqItem,
    undefined as ContentActionResult | undefined,
  );

  return (
    <li className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <form action={upAction} className="inline">
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="direction" value="up" />
            <button type="submit" disabled={upPending || index === 0} className={btnGhost}>
              Move up
            </button>
          </form>
          <form action={downAction} className="inline">
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="direction" value="down" />
            <button type="submit" disabled={downPending || index >= total - 1} className={btnGhost}>
              Move down
            </button>
          </form>
          <span className="self-center text-xs text-zinc-500">Order: {f.sortOrder}</span>
        </div>
        <ConfirmForm message="Delete this FAQ entry?" action={delAction} className="inline">
          <input type="hidden" name="id" value={f.id} />
          <button type="submit" disabled={delPending} className={btnDanger}>
            Delete
          </button>
        </ConfirmForm>
      </div>
      <ErrorBanner state={updState ?? delState ?? upState ?? downState} />
      <form action={updAction} className="flex max-w-2xl flex-col gap-3">
        <input type="hidden" name="id" value={f.id} />
        <div>
          <label className={labelClass}>Question</label>
          <input name="question" required defaultValue={f.question} className={`${formClass} mt-1 w-full`} />
        </div>
        <div>
          <label className={labelClass}>Answer</label>
          <textarea name="answer" required rows={4} defaultValue={f.answer} className={`${formClass} mt-1 w-full`} />
        </div>
        <div>
          <label className={labelClass}>Sort order</label>
          <input
            name="sortOrder"
            type="number"
            defaultValue={f.sortOrder}
            className={`${formClass} mt-1 w-full max-w-xs`}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input type="checkbox" name="published" defaultChecked={f.published} className="rounded border-zinc-300" />
          Published
        </label>
        <button type="submit" disabled={updPending} className={`${btnSecondary} w-fit px-3 py-2 text-sm`}>
          {updPending ? "Saving…" : "Update"}
        </button>
      </form>
    </li>
  );
}
