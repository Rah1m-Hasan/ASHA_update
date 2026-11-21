import type { Metadata } from "next";
import { LegacyEntry } from "@/components/dashboard/LegacyEntry";
import { CareLoop } from "@/components/landing/CareLoop";
import { Closing } from "@/components/landing/Closing";
import { Contact } from "@/components/landing/Contact";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { HardwareKit } from "@/components/landing/HardwareKit";
import { Hero } from "@/components/landing/Hero";
import { Journeys } from "@/components/landing/Journeys";
import { Languages } from "@/components/landing/Languages";
import { Modules } from "@/components/landing/Modules";
import { Navbar } from "@/components/landing/Navbar";
import { Plans } from "@/components/landing/Plans";
import { Principles } from "@/components/landing/Principles";
import { Story } from "@/components/landing/Story";
import { Team } from "@/components/landing/Team";
import { hero } from "@/content/landing";

export const metadata: Metadata = {
  title: `Asha — ${hero.title}`,
  description: "Asha is an assistive communication companion that helps people express their needs and stay connected with caregivers.",
  manifest: "/app.webmanifest",
  openGraph: {
    title: `Asha — ${hero.title}`,
    description: "An assistive communication companion for people and the people who care for them.",
    type: "website",
    images: [{ url: "/assets/brand/asha-icon-512.png", width: 512, height: 512, alt: "Asha" }],
  },
  twitter: {
    card: "summary",
    title: `Asha — ${hero.title}`,
    description: "An assistive communication companion for people and the people who care for them.",
    images: ["/assets/brand/asha-icon-512.png"],
  },
};

// The one page about Asha. "Try Asha" opens the app home, where people choose what they want to use.
export default function HomePage() {
  return (
    // The dark theme re-declares the colour tokens on :root, so this page and
    // the dashboard behind "Try Asha" both follow the same switch.
    <div className="min-h-screen bg-canvas">
      {/* Old private links (#token=…, ?module=…) still open the original assistive app. */}
      <LegacyEntry />
      <Navbar />
      <main>
        <Hero />
        <Journeys />
        <Story />
        <Modules />
        <CareLoop />
        <HardwareKit />
        <Languages />
        <Plans />
        <Principles />
        <Team />
        <Faq />
        <Contact />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
