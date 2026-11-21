import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { THEME_INIT_SCRIPT } from "@/features/theme/theme.js";
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
    // suppressHydrationWarning: the inline script below sets data-theme and
    // data-theme-pref on <html> before React hydrates. React 19 never patches
    // an attribute it disagrees about, and the flag silences the report.
    <html lang="en" data-theme="light" data-theme-pref="system" suppressHydrationWarning className={inter.variable}>
      <body>
        {/* Sets the theme before the first paint. It has to be an inline classic
            script as the first child of <body>: it runs synchronously during
            parsing, so the page never flashes the wrong theme. (next/script's
            beforeInteractive strategy does not do this in the App Router.) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
