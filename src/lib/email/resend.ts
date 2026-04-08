/**
 * Announcement email blast — wire Resend when admin portal manages subscribers.
 * Set RESEND_API_KEY in production to enable.
 */
export async function sendAnnouncementEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  void opts.to;
  void opts.subject;
  void opts.html;
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  return { ok: false, error: "Not implemented" };
}
