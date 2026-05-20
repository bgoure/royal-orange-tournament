"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function safeCallbackPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/admin";
  return raw.split("?")[0] ?? "/admin";
}

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "This e-mail is already on file. Sign in with the Google account that uses the same e-mail as your staff invite (check spelling and aliases). If it still fails, ask an admin to update your invited e-mail.",
  Configuration:
    "Sign-in is misconfigured on the server. Contact an administrator.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link expired or was already used. Try signing in again.",
  Default: "Something went wrong while signing in.",
};

export function AuthErrorClient() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error") ?? "Default";
  const path = safeCallbackPath(searchParams.get("callbackUrl"));
  const callbackUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const message = errorMessages[code] ?? errorMessages.Default;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Sign-in problem</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Code: <span className="font-mono text-zinc-800">{code}</span>
        </p>
      </div>
      <div className="rounded-xl bg-red-600 px-4 py-3 text-sm leading-relaxed text-white">{message}</div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
        onClick={() => void signIn("google", { callbackUrl })}
      >
        Sign in with Google
      </button>
      <p className="text-center text-sm text-zinc-600">
        <Link href="/login" className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700">
          Back to staff sign in
        </Link>
      </p>
    </div>
  );
}
