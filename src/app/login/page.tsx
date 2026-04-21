import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginClient } from "@/app/login/LoginClient";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-md px-4 py-12 text-sm text-zinc-600">Loading…</div>}
    >
      <LoginClient />
    </Suspense>
  );
}
