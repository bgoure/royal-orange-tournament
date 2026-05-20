import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthErrorClient } from "@/app/auth/error/AuthErrorClient";

export const metadata: Metadata = {
  title: "Sign-in error",
  robots: { index: false, follow: false },
};

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-md px-4 py-12 text-sm text-zinc-600">Loading…</div>}
    >
      <AuthErrorClient />
    </Suspense>
  );
}
