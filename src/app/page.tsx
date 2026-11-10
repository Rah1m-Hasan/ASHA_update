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

export const metadata: Metadata = {
  title: "Asha — A little support. A lot more independence.",
  description: "Asha helps people communicate their needs, move, eat well and stay connected with the people who care for them.",
  manifest: "/app.webmanifest",
};

// The one page about Asha. "Try Asha" opens the app home, where people choose what they want to use.
export default function HomePage() {
  return (
    <>
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
    </>
  );
}
