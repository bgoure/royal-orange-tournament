"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { inviteUser, type UserAdminActionResult } from "@/app/admin/_actions/users";

const formClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50";

type DivisionOpt = { id: string; name: string };

const INVITE_DRAWER_AUTO_CLOSE_MS = 30_000;

export function InviteUserSheet({
  canInvite,
  divisionOptions,
}: {
  canInvite: boolean;
  divisionOptions: DivisionOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("POWER_USER");
  const [selectedDivisions, setSelectedDivisions] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(
    inviteUser,
    undefined as UserAdminActionResult | undefined,
  );
  const wasPendingRef = useRef(false);

  useEffect(() => {
    const finishedSubmit = wasPendingRef.current && !pending;
    wasPendingRef.current = pending;

    if (!finishedSubmit || !open) return;

    if (state?.ok && state.notice) {
      router.refresh();
      const id = window.setTimeout(() => {
        setOpen(false);
        setSelectedDivisions(new Set());
      }, INVITE_DRAWER_AUTO_CLOSE_MS);
      return () => window.clearTimeout(id);
    }

    if (state && !state.ok) {
      router.refresh();
    }
    return undefined;
  }, [pending, state, open, router]);

  if (!canInvite) return null;

  const isPowerUser = selectedRole === "POWER_USER";
  const canSubmit = !isPowerUser || selectedDivisions.size > 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        Add user
      </button>
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[80] flex max-h-[90vh] flex-col rounded-t-2xl bg-white outline-none">
            <Drawer.Title className="sr-only">Invite user</Drawer.Title>
            <div className="flex shrink-0 justify-center pt-3">
              <Drawer.Handle className="h-1 w-10 rounded-full bg-zinc-300" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
              <h2 className="text-lg font-semibold text-zinc-900">Add user</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Creates the account for this Google email and sends a short invite. They must sign in with Google using
                the same address. Delivery requires{" "}
                <code className="rounded bg-zinc-100 px-1 text-xs">RESEND_API_KEY</code> and usually a verified{" "}
                <code className="rounded bg-zinc-100 px-1 text-xs">RESEND_FROM</code> domain; otherwise Resend’s test
                check the notice after you tap save (the sheet stays open about 30 seconds). If email still doesn’t arrive,
                copy the Resend message id from the notice into Resend → Emails.
              </p>
              {state && !state.ok ? (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
                  {state.error}
                </p>
              ) : null}
              {state?.ok && state.notice ? (
                <p
                  className={`mt-3 rounded-md px-3 py-2 text-sm ring-1 ${
                    state.noticeTone === "warning"
                      ? "bg-amber-50 text-amber-950 ring-amber-200"
                      : "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  }`}
                  role="status"
                >
                  {state.notice}
                </p>
              ) : null}
              <form action={action} className="mt-4 flex flex-col gap-4">
                <div>
                  <label htmlFor="invite-name" className={labelClass}>
                    Display name (optional)
                  </label>
                  <input id="invite-name" name="name" type="text" autoComplete="name" className={formClass} />
                </div>
                <div>
                  <label htmlFor="invite-email" className={labelClass}>
                    Email (Google account)
                  </label>
                  <input
                    id="invite-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={formClass}
                    placeholder="director@school.org"
                  />
                </div>
                <div>
                  <label htmlFor="invite-role" className={labelClass}>
                    Role
                  </label>
                  <select
                    id="invite-role"
                    name="role"
                    required
                    className={formClass}
                    value={selectedRole}
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                      if (e.target.value !== "POWER_USER") setSelectedDivisions(new Set());
                    }}
                  >
                    <option value="POWER_USER">Power user</option>
                    <option value="ADMIN">Admin</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </div>

                {isPowerUser ? (
                  <fieldset className="flex flex-col gap-2">
                    <legend className={labelClass}>
                      Assigned divisions <span className="text-red-500">*</span>
                    </legend>
                    <p className="text-xs text-zinc-500">
                      Power users can only manage games, teams, and content within their assigned divisions.
                    </p>
                    {divisionOptions.length === 0 ? (
                      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                        No divisions exist yet. Create divisions first before inviting power users.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {divisionOptions.map((d) => (
                          <label key={d.id} className="flex items-center gap-2 text-sm text-zinc-800">
                            <input
                              type="checkbox"
                              checked={selectedDivisions.has(d.id)}
                              onChange={(e) => {
                                const next = new Set(selectedDivisions);
                                if (e.target.checked) next.add(d.id);
                                else next.delete(d.id);
                                setSelectedDivisions(next);
                              }}
                              className="size-4 rounded border-zinc-300 text-royal focus:ring-royal"
                            />
                            {d.name}
                          </label>
                        ))}
                      </div>
                    )}
                    {isPowerUser && selectedDivisions.size === 0 && divisionOptions.length > 0 ? (
                      <p className="text-xs text-red-600">Select at least one division.</p>
                    ) : null}
                  </fieldset>
                ) : null}

                <input type="hidden" name="divisionIds" value={Array.from(selectedDivisions).join(",")} />

                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="submit" disabled={pending || !canSubmit} className={btnPrimary}>
                    {pending ? "Saving…" : "Save & send invite"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
