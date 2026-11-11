import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted Inter (variable, latin) — no build-time network fetch.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://neurobridge-asha-live.vercel.app"),
  title: "Asha — Care that understands beyond words",
  description:
    "Asha is an assistive communication companion that helps people with limited speech or movement express their needs, and keeps caregivers in the loop.",
  icons: {
    icon: "/assets/brand/asha-favicon-48.png",
    apple: "/assets/brand/asha-apple-touch-180.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
