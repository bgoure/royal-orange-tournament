"use client";

import type { Announcement } from "@prisma/client";
import Link from "next/link";
import { useCallback, useState, type KeyboardEvent } from "react";
import { AnimatedListItem } from "@/components/ui/AnimatedListItem";
import { formatAnnouncementPublishedLabel } from "@/lib/announcement-display";
import { PublicAnnouncementEditModal } from "@/components/announcements/PublicAnnouncementEditModal";
import { publicGlassCardXl } from "@/lib/public-glass-card";

const metaSm = "text-[10px] leading-tight text-zinc-500";
const metaDefault = "text-xs text-zinc-500";

export function AnnouncementList({
  items,
  seeMoreHref,
  compactMeta = false,
  adminEditable = false,
  tournamentSlug,
}: {
  items: Announcement[];
  seeMoreHref?: string;
  compactMeta?: boolean;
  adminEditable?: boolean;
  tournamentSlug?: string;
}) {
  const [editing, setEditing] = useState<Announcement | null>(null);
  const metaClass = compactMeta ? metaSm : metaDefault;
  const seeMoreClass = `${metaClass} font-semibold text-royal underline-offset-2 hover:underline`;

  const openEdit = useCallback((a: Announcement) => {
    setEditing(a);
  }, []);

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No announcements yet.</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((a, i) => {
          const shell = a.priority
            ? "rounded-xl border border-amber-200/60 bg-amber-50/75 px-4 py-3 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-amber-700/45 dark:bg-amber-950/35 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]"
            : `px-4 py-3 ${publicGlassCardXl}`;

          const content = (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-zinc-900">{a.title}</h3>
                <time className={metaClass} dateTime={a.publishedAt.toISOString()}>
                  {formatAnnouncementPublishedLabel(a.publishedAt)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{a.body}</p>
              {seeMoreHref ? (
                <div className="mt-2 flex justify-end">
                  <Link href={seeMoreHref} className={seeMoreClass}>
                    See more
                  </Link>
                </div>
              ) : null}
            </>
          );

          if (adminEditable && tournamentSlug) {
            const activate = () => openEdit(a);
            const adminShell = `cursor-pointer ring-2 ring-amber-400/30 transition-[box-shadow] hover:ring-amber-500/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 ${shell}`;
            return (
              <AnimatedListItem key={a.id} index={i} className={adminShell}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={activate}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activate();
                    }
                  }}
                >
                  {content}
                </div>
              </AnimatedListItem>
            );
          }

          return (
            <AnimatedListItem key={a.id} index={i} className={shell}>
              {content}
            </AnimatedListItem>
          );
        })}
      </ul>
      {editing && tournamentSlug ? (
        <PublicAnnouncementEditModal
          announcement={editing}
          tournamentSlug={tournamentSlug}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
