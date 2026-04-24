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
          const isPriority = a.priority;
          const shell = isPriority
            ? "rounded-xl border border-orange-200/60 bg-orange-50/80 px-4 py-3 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-orange-800/45 dark:bg-orange-950/30 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]"
            : `px-4 py-3 ${publicGlassCardXl}`;

          const metaPriority = compactMeta
            ? "text-[10px] leading-tight text-royal/65 dark:text-royal-200/70"
            : "text-xs text-royal/65 dark:text-royal-200/70";
          const metaResolved = isPriority ? metaPriority : metaClass;
          const seeMoreResolved = isPriority
            ? `${metaResolved} font-semibold text-royal underline-offset-2 hover:underline dark:text-royal-100`
            : seeMoreClass;

          const content = (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3
                  className={
                    isPriority
                      ? "text-sm font-semibold text-royal dark:text-royal-100"
                      : "font-semibold text-zinc-900 dark:text-zinc-100"
                  }
                >
                  {a.title}
                </h3>
                <time className={metaResolved} dateTime={a.publishedAt.toISOString()}>
                  {formatAnnouncementPublishedLabel(a.publishedAt)}
                </time>
              </div>
              <p
                className={
                  isPriority
                    ? "mt-2 whitespace-pre-wrap text-xs leading-relaxed text-royal dark:text-royal-100"
                    : "mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                }
              >
                {a.body}
              </p>
              {seeMoreHref ? (
                <div className="mt-2 flex justify-end">
                  <Link href={seeMoreHref} className={seeMoreResolved}>
                    See more
                  </Link>
                </div>
              ) : null}
            </>
          );

          if (adminEditable && tournamentSlug) {
            const activate = () => openEdit(a);
            const adminRing = isPriority
              ? "ring-orange-400/30 hover:ring-orange-500/55"
              : "ring-amber-400/30 hover:ring-amber-500/55";
            const adminShell = `cursor-pointer ring-2 ${adminRing} transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 ${shell}`;
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
