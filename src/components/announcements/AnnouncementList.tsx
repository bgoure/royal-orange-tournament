import type { Announcement } from "@prisma/client";

function formatTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function AnnouncementList({ items }: { items: Announcement[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No announcements yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => (
        <li
          key={a.id}
          className={`rounded-xl border px-4 py-3 ${
            a.priority
              ? "border-amber-200 bg-amber-50/80"
              : "border-zinc-200 bg-white shadow-sm"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-zinc-900">{a.title}</h3>
            <time className="text-xs text-zinc-500" dateTime={a.publishedAt.toISOString()}>
              {formatTime(a.publishedAt)}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{a.body}</p>
        </li>
      ))}
    </ul>
  );
}
