import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Expose Git SHA at build time so deploy stamp matches GitHub/Vercel (optional fallback).
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  /**
   * Baseline security headers for every response.
   *
   * CSP plan (intentionally NOT enabled yet — it would break the app as it stands):
   *   1. Next.js injects inline bootstrap scripts and Tailwind/next/font inject inline styles,
   *      so a useful policy needs `strict-dynamic` with a per-request nonce plumbed through
   *      proxy.ts into `<script>`/`<style>` tags, or `'unsafe-inline'` (which buys little).
   *   2. connect-src must allow Vercel analytics, Auth.js callbacks, and api.open-meteo.com.
   *   3. img-src must allow data: and blob: (QR codes, jsPDF/modern-screenshot exports,
   *      DB-served team/sponsor logos) plus Google avatar hosts from OAuth profiles.
   *   4. frame-src must allow any embedded map/social widgets before locking it down.
   * Rollout: ship `Content-Security-Policy-Report-Only` on staging first, collect violations
   * for a full tournament weekend, then promote to enforcing.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Belt-and-braces with X-Frame-Options for browsers that ignore the legacy header.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:tournamentSlug/standings",
        destination: "/:tournamentSlug/results",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
