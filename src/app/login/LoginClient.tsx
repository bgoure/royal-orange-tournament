"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function safeCallbackPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/admin";
  return raw.split("?")[0] ?? "/admin";
}

export function LoginClient() {
  const searchParams = useSearchParams();
  const path = safeCallbackPath(searchParams.get("callbackUrl"));
  const callbackUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Staff sign in</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Continue with the account that has access to the admin portal. You are signing in on{" "}
          <span className="font-medium text-zinc-800">{typeof window !== "undefined" ? window.location.host : "…"}</span>
          .
        </p>
      </div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
        onClick={() => void signIn("google", { callbackUrl })}
      >
        Continue with Google
      </button>
    </div>
  );
}
