"use client";

import type { Announcement } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";
import {
  announcementEmailStatusNote,
  formatAnnouncementDateTimeLocal,
} from "@/lib/announcement-display";
import {
  deletePublicAnnouncementFromSite,
  updatePublicAnnouncementFromSite,
  type PublicAnnouncementResult,
} from "@/lib/actions/public-announcement";

const formClass =
  "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "min-h-11 flex-1 rounded-xl bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-royal-800 disabled:opacity-50";
const btnSecondary =
  "min-h-11 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50";
const btnDanger =
  "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50";

export function PublicAnnouncementEditModal({
  announcement: a,
  tournamentSlug,
  onClose,
}: {
  announcement: Announcement;
  tournamentSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [updState, updAction, updPending] = useActionState(
    updatePublicAnnouncementFromSite,
    undefined as PublicAnnouncementResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    deletePublicAnnouncementFromSite,
    undefined as PublicAnnouncementResult | undefined,
  );

  useEffect(() => {
    if (updState?.ok) {
      onClose();
      router.refresh();
    }
  }, [updState, onClose, router]);

  useEffect(() => {
    if (delState?.ok) {
      onClose();
      router.refresh();
    }
  }, [delState, onClose, router]);

  const emailSent = a.emailDeliveryStatus === "SENT";
  const err =
    updState && !updState.ok
      ? updState.error
      : delState && !delState.ok
        ? delState.error
        : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pam-dialog-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <h2 id="pam-dialog-title" className="text-base font-semibold text-zinc-900">
            Edit announcement
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="text-xs text-zinc-600">
            Email:{" "}
            <span className="font-medium text-zinc-800">{announcementEmailStatusNote(a.emailDeliveryStatus)}</span>
            {a.emailSentAt ? (
              <span className="ml-1 text-zinc-500">· Sent {new Date(a.emailSentAt).toLocaleString()}</span>
            ) : null}
          </p>
          {a.emailError ? (
            <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{a.emailError}</p>
          ) : null}
          {err ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
              {err}
            </p>
          ) : null}
          {updState?.ok && updState.notice ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
              {updState.notice}
            </p>
          ) : null}

          <form action={updAction} className="flex flex-col gap-3">
            <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
            <input type="hidden" name="id" value={a.id} />
            <div>
              <label htmlFor="pam-title-in" className={labelClass}>
                Title
              </label>
              <input
                id="pam-title-in"
                name="title"
                required
                defaultValue={a.title}
                className={`${formClass} mt-1 w-full`}
              />
            </div>
            <div>
              <label htmlFor="pam-body" className={labelClass}>
                Body
              </label>
              <textarea
                id="pam-body"
                name="body"
                required
                rows={5}
                defaultValue={a.body}
                className={`${formClass} mt-1 w-full`}
              />
            </div>
            <div>
              <label htmlFor="pam-published" className={labelClass}>
                Published
              </label>
              <input
                id="pam-published"
                name="publishedAt"
                type="datetime-local"
                defaultValue={formatAnnouncementDateTimeLocal(a.publishedAt)}
                className={`${formClass} mt-1 w-full max-w-xs`}
              />
            </div>
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
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={updPending} className={btnPrimary}>
                {updPending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={onClose} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </form>

          <div className="border-t border-zinc-200 pt-4">
            <ConfirmForm
              message="Delete this announcement permanently?"
              action={delAction}
              className="inline"
            >
              <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
              <input type="hidden" name="id" value={a.id} />
              <button type="submit" disabled={delPending} className={btnDanger}>
                {delPending ? "Deleting…" : "Delete announcement"}
              </button>
            </ConfirmForm>
          </div>
        </div>
      </div>
    </div>
  );
}
