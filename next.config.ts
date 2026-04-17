import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Expose Git SHA at build time so deploy stamp matches GitHub/Vercel (optional fallback).
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
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
