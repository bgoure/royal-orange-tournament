import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a1a2e",
};

const metadataBaseUrl = (() => {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!raw) return new URL("http://localhost:3000");
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: "R&O 2026",
  description: "Royal & Orange 2026 — schedules, scores, standings, and brackets.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/ro_favicon_16.ico", sizes: "16x16", type: "image/x-icon" },
      { url: "/ro_favicon_32.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/ro_favicon_48.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    apple: { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "R&O Classic",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
