"use client";

import { useActionState } from "react";
import type { Role } from "@prisma/client";
import { removeUserAccess, updateUserRole, type UserAdminActionResult } from "@/app/admin/_actions/users";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50";

export type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
};

function roleLabel(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "POWER_USER":
      return "Power user";
    case "PUBLIC":
      return "Public";
    default:
      return role;
  }
}

function ErrorLine({ state }: { state: UserAdminActionResult | undefined }) {
  if (!state || state.ok) return null;
  return <p className="text-xs text-red-700">{state.error}</p>;
}

function SuccessLine({ state }: { state: UserAdminActionResult | undefined }) {
  if (!state || !state.ok || !state.notice) return null;
  return <p className="text-xs text-emerald-800">{state.notice}</p>;
}

function UserTableRow({ user, actorUserId, canManage }: { user: UserRow; actorUserId: string; canManage: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateUserRole,
    undefined as UserAdminActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(
    removeUserAccess,
    undefined as UserAdminActionResult | undefined,
  );

  return (
    <tr className="border-b border-zinc-100 last:border-0">
      <td className="px-3 py-3 align-top text-sm text-zinc-900">
        <span className="font-medium">{user.email ?? "—"}</span>
        {user.id === actorUserId ? (
          <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            (you)
          </span>
        ) : null}
        {user.name ? <p className="mt-0.5 text-xs text-zinc-500">{user.name}</p> : null}
      </td>
      <td className="px-3 py-3 align-top">
        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
          {roleLabel(user.role)}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        {!canManage ? (
          <span className="text-xs text-zinc-500">—</span>
        ) : (
          <div className="flex max-w-md flex-col gap-2">
            <ErrorLine state={roleState ?? delState} />
            <SuccessLine state={roleState} />
            <SuccessLine state={delState} />
            <form action={roleAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <label htmlFor={`role-${user.id}`} className="sr-only">
                Role for {user.email ?? user.id}
              </label>
              <select
                id={`role-${user.id}`}
                name="role"
                defaultValue={user.role}
                className={`${formClass} min-w-[10rem]`}
              >
                <option value="PUBLIC">Public</option>
                <option value="POWER_USER">Power user</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button type="submit" disabled={rolePending} className={btnSecondary}>
                {rolePending ? "Saving…" : "Update role"}
              </button>
            </form>
            <ConfirmForm
              message={`Remove access for ${user.email ?? "this user"}? They will no longer be able to sign in.`}
              action={delAction}
              className="inline"
            >
              <input type="hidden" name="userId" value={user.id} />
              <button type="submit" disabled={delPending} className={btnDanger}>
                {delPending ? "Removing…" : "Remove access"}
              </button>
            </ConfirmForm>
          </div>
        )}
      </td>
    </tr>
  );
}

export function UsersAdmin({
  users,
  actorUserId,
  canManage,
}: {
  users: UserRow[];
  actorUserId: string;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-zinc-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Users</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Change roles between public, power user, and admin. At least one admin must always remain; the sole admin
          cannot demote or delete themselves.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Role</th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserTableRow key={u.id} user={u} actorUserId={actorUserId} canManage={canManage} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
