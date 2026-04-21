import type { Announcement } from "@prisma/client";

export function formatAnnouncementDateTimeLocal(d: Date): string {
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

export function formatAnnouncementPublishedLabel(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function announcementEmailStatusNote(status: Announcement["emailDeliveryStatus"]): string {
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
