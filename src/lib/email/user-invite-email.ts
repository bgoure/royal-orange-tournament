import { Resend } from "resend";
import { getResendFromAddress } from "@/lib/email/resend";

export type StaffInviteEmailResult =
  | { ok: true; usingResendTestDomain: boolean }
  | { ok: false; error: string };

export async function sendStaffInviteEmail(opts: {
  to: string;
  displayName: string | null;
  roleLabel: string;
  signInUrl: string;
}): Promise<StaffInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getResendFromAddress();
  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "RESEND_API_KEY or RESEND_FROM not configured. Add RESEND_API_KEY; set RESEND_FROM to an address on a domain you verified in Resend.",
    };
  }

  const usingResendTestDomain = from.includes("resend.dev");

  const resend = new Resend(apiKey);
  const greeting = opts.displayName?.trim() ? `Hi ${opts.displayName.trim()},` : "Hi,";
  const text = [
    greeting,
    "",
    `You've been invited to Tournament Hub with role: ${opts.roleLabel}.`,
    "Sign in with Google using this same email address to access the admin portal.",
    "",
    opts.signInUrl,
    "",
    "If you did not expect this message, you can ignore it.",
  ].join("\n");

  const html = `<p>${greeting.replace(/\n/g, "<br/>")}</p>
<p>You've been invited to <strong>Tournament Hub</strong> with role: <strong>${escapeHtml(opts.roleLabel)}</strong>.</p>
<p>Sign in with <strong>Google</strong> using this same email address to access the admin portal.</p>
<p><a href="${escapeHtml(opts.signInUrl)}">Open sign-in</a></p>
<p style="color:#71717a;font-size:12px">If you did not expect this message, you can ignore it.</p>`;

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: "You're invited to Tournament Hub",
    html,
    text,
  });

  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "Resend send failed";
    const hint = usingResendTestDomain
      ? " With onboarding@resend.dev, Resend often only delivers to addresses you add as verified recipients in the Resend dashboard (or use a verified domain in RESEND_FROM)."
      : "";
    return { ok: false, error: msg + hint };
  }
  return { ok: true, usingResendTestDomain };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
