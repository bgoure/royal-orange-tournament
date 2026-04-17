import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "R&O 2026",
  description: "Royal & Orange 2026 — schedules, scores, standings, and brackets.",
  manifest: "/manifest.json",
  themeColor: "#1a1a2e",
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
    title: "Royal & Orange Classic",
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
