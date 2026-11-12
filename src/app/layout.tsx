import type { Metadata } from "next";
import "./globals.css";
import "./asha-fonts.css";

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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/*
          The colour theme is a personal choice, so it is applied before the
          first paint: a flash of the wrong theme is worse than a moment of
          plain text. The same rule lives in the two legacy apps.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("asha_theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
