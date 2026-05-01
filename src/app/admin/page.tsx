import Link from "next/link";
import { auth } from "@/auth";
import { submitHubPublicSwitcherOrder } from "@/app/admin/_actions/tournament-basics";
import { can } from "@/lib/rbac/permissions";
import { listTournamentsForAdminHub } from "@/lib/tournament-context";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export const dynamic = "force-dynamic";

function formatDateRange(start: Date, end: Date): string {
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const a = start.toLocaleDateString("en-CA", opt);
  const b = end.toLocaleDateString("en-CA", opt);
  return start.getTime() === end.getTime() ? a : `${a} – ${b}`;
}

export default async function AdminTournamentsHubPage() {
  const [session, rows] = await Promise.all([auth(), listTournamentsForAdminHub()]);
  const canManageContent = session?.user?.role != null && can(session.user.role, "content:manage");

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-zinc-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Tournaments</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Choose which event you are working on. Public switcher order (lower sorts first) can be adjusted
          here for quick setup; detailed branding and headquarters stay under Tournament Admin for each
          event.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Tournament</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Public order</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((t) => {
              const publicPath = tournamentPublicBasePath(t);
              const selectHref = `/admin/select/${encodeURIComponent(t.slug)}?next=${encodeURIComponent("/admin/tournament-settings")}`;
              return (
                <tr key={t.id} className="text-zinc-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{t.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-zinc-500">{t.slug}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-zinc-500">{t.locationLabel}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {formatDateRange(t.startDate, t.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    {t.archivedAt != null ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Archived
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                        Live
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManageContent ? (
                      <form action={submitHubPublicSwitcherOrder} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="tournamentId" value={t.id} />
                        <input
                          name="publicSwitcherOrder"
                          type="number"
                          min={0}
                          max={999_999}
                          step={1}
                          defaultValue={t.publicSwitcherOrder}
                          className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm tabular-nums"
                          aria-label={`Public switcher order for ${t.name}`}
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <span className="tabular-nums text-zinc-700">{t.publicSwitcherOrder}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                      <Link
                        href={selectHref}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Open admin
                      </Link>
                      <Link
                        href={publicPath}
                        className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
                      >
                        Public site
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
          No published tournaments yet. Use Create tournament in the header strip after selecting any
          event, or seed the database.
        </p>
      ) : null}
    </div>
  );
}
