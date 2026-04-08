"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Announcement } from "@prisma/client";
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
  type AnnouncementActionResult,
} from "@/app/admin/_actions/announcements";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100";

function fmtLocal(d: Date) {
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

function emailStatusNote(status: Announcement["emailDeliveryStatus"]): string {
  switch (status) {
    case "NOT_SENT":
      return "No email sent yet.";
    case "SENDING":
      return "Email send in progress.";
    case "SENT":
      return "Email successfully sent (no duplicate sends).";
    case "FAILED":
      return "Last email attempt failed.";
    case "SKIPPED_NO_SUBSCRIBERS":
      return "Skipped: no matching subscriber emails.";
    case "SKIPPED_NO_API_KEY":
      return "Skipped: Resend not configured.";
    default:
      return status;
  }
}

function ErrorBanner({ state }: { state: AnnouncementActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
      {state.error}
    </p>
  );
}

function SuccessBanner({ state }: { state: AnnouncementActionResult | undefined }) {
  if (!state || !state.ok || !state.notice) return null;
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
      {state.notice}
    </p>
  );
}

export function AnnouncementsAdmin({
  items,
  tournamentName,
  canManage,
}: {
  items: Announcement[];
  tournamentName: string;
  canManage: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createAnnouncement,
    undefined as AnnouncementActionResult | undefined,
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Announcements</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </div>
        <Link href="/" className={btnSecondary}>
          View site ↗
        </Link>
      </header>

      {!canManage ? (
        <p className="text-sm text-zinc-600">You don’t have permission to manage announcements.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-600">
            Emails go to tournament subscribers whose role label is empty (general list) or contains coach,
            manager, or director. Check <strong>Send as email</strong> only when you want to push this save (won’t
            resend if status is already sent).
          </p>

          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">New announcement</h2>
            <ErrorBanner state={createState} />
            <SuccessBanner state={createState} />
            <form action={createAction} className="mt-4 flex max-w-2xl flex-col gap-4">
              <div>
                <label htmlFor="new-title" className={labelClass}>
                  Title
                </label>
                <input id="new-title" name="title" required className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label htmlFor="new-body" className={labelClass}>
                  Body
                </label>
                <textarea id="new-body" name="body" required rows={5} className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label htmlFor="new-published" className={labelClass}>
                  Published
                </label>
                <input
                  id="new-published"
                  name="publishedAt"
                  type="datetime-local"
                  defaultValue={fmtLocal(new Date())}
                  className={`${formClass} mt-1 w-full max-w-xs`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-zinc-800">
                  <input type="checkbox" name="priority" className="rounded border-zinc-300" />
                  Priority (highlight on home page)
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-800">
                  <input type="checkbox" name="sendEmail" className="rounded border-zinc-300" />
                  Send as email (Resend)
                </label>
              </div>
              <button type="submit" disabled={createPending} className={`${btnPrimary} w-fit`}>
                {createPending ? "Saving…" : "Publish"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">Existing</h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">None yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-6">
                {items.map((a) => (
                  <AnnouncementEditRow key={a.id} announcement={a} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AnnouncementEditRow({ announcement: a }: { announcement: Announcement }) {
  const [updState, updAction, updPending] = useActionState(
    updateAnnouncement,
    undefined as AnnouncementActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteAnnouncement,
    undefined as AnnouncementActionResult | undefined,
  );

  const emailSent = a.emailDeliveryStatus === "SENT";

  return (
    <li className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-600">
          Email: <span className="font-medium text-zinc-800">{emailStatusNote(a.emailDeliveryStatus)}</span>
          {a.emailSentAt ? (
            <span className="ml-2 text-zinc-500">
              · Sent {new Date(a.emailSentAt).toLocaleString()}
            </span>
          ) : null}
        </p>
        <ConfirmForm message="Delete this announcement?" action={delAction} className="inline">
          <input type="hidden" name="id" value={a.id} />
          <button type="submit" disabled={delPending} className={btnDanger}>
            Delete
          </button>
        </ConfirmForm>
      </div>
      {a.emailError ? (
        <p className="mb-3 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{a.emailError}</p>
      ) : null}
      <ErrorBanner state={updState ?? delState} />
      <SuccessBanner state={updState} />
      <form action={updAction} className="flex max-w-2xl flex-col gap-3">
        <input type="hidden" name="id" value={a.id} />
        <div>
          <label className={labelClass}>Title</label>
          <input name="title" required defaultValue={a.title} className={`${formClass} mt-1 w-full`} />
        </div>
        <div>
          <label className={labelClass}>Body</label>
          <textarea name="body" required rows={4} defaultValue={a.body} className={`${formClass} mt-1 w-full`} />
        </div>
        <div>
          <label className={labelClass}>Published</label>
          <input
            name="publishedAt"
            type="datetime-local"
            defaultValue={fmtLocal(a.publishedAt)}
            className={`${formClass} mt-1 w-full max-w-xs`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" name="priority" defaultChecked={a.priority} className="rounded border-zinc-300" />
            Priority
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              name="sendEmail"
              defaultChecked={a.notifySubscribers}
              className="rounded border-zinc-300"
            />
            Send as email
            {emailSent ? (
              <span className="text-xs font-normal text-zinc-500">(already delivered — won&apos;t resend)</span>
            ) : null}
          </label>
        </div>
        <button type="submit" disabled={updPending} className={`${btnSecondary} w-fit px-3 py-2 text-sm`}>
          {updPending ? "Saving…" : "Update"}
        </button>
      </form>
    </li>
  );
}
