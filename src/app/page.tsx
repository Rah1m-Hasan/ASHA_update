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

export default function HomePage() {
  return (
    <>
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
