import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getTournamentForRequest } from "@/lib/tournament-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateViewport(): Promise<Viewport> {
  const t = await getTournamentForRequest();
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: t?.pwaThemeColor?.trim() || "#1a1a2e",
  };
}

export const metadata: Metadata = {
  title: "R&O 2026",
  description: "Royal & Orange 2026 — schedules, scores, standings, and brackets.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tournament Tracker",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
