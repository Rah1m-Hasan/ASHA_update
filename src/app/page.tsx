import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LegacyEntry } from "@/components/dashboard/LegacyEntry";
import { buttonClass } from "@/components/ui/Button";
import {
  ArrowIcon,
  ChatIcon,
  HeartIcon,
  UsersIcon,
} from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Asha — Choose your workspace",
  description:
    "Everyday support, complete assistive communication tools, and a connected caregiver workspace.",
  manifest: "/app.webmanifest",
};

const modules = [
  { key: "facespeak", label: "FaceSpeak" },
  { key: "fingerspeak", label: "FingerSpeak" },
  { key: "senseassist", label: "SenseAssist" },
  { key: "vitalsense", label: "VitalSense" },
  { key: "posture", label: "Posture" },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-wash">
      <LegacyEntry />
      <a
        href="#workspaces"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to workspaces
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-20 max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Asha home">
            <Image
              src="/assets/brand/asha-side-540.png"
              alt="Asha"
              width={120}
              height={40}
              priority
              className="h-9 w-auto"
            />
          </Link>
          <a
            href="https://asha-neurobridge-website.vercel.app/"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-3 text-sm font-medium text-muted hover:text-brand"
          >
            About Asha <ArrowIcon size={16} />
          </a>
        </div>
      </header>
      <main
        id="workspaces"
        className="mx-auto max-w-[1120px] px-5 pt-12 pb-12 sm:px-8 sm:pt-16"
      >
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-brand uppercase">
            Your Asha workspace
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-heading sm:text-5xl">
            A little support.
            <br />
            Your way, every day.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Choose everyday wellbeing, a way to communicate, or support for
            someone you care for.
          </p>
        </div>

        <div className="grid items-stretch gap-5 md:grid-cols-2">
          <section className="flex flex-col rounded-3xl border border-line bg-white p-7 shadow-card sm:p-8">
            <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
              <HeartIcon size={25} />
            </span>
            <h2 className="text-2xl font-semibold text-heading">
              Everyday companion
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Keep a food journal, practise movement, communicate with EyeSpeak,
              and prepare for care visits.
            </p>
            <p className="mt-4 text-sm font-medium text-ink">
              Nutrition · Move · EyeSpeak · Care · Clinic
            </p>
            <div className="mt-auto pt-7">
              <a href="/everyday.html" className={buttonClass()}>
                Open Everyday <ArrowIcon size={17} />
              </a>
            </div>
          </section>

          <section className="flex flex-col rounded-3xl border border-line bg-white p-7 shadow-card sm:p-8">
            <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
              <ChatIcon size={25} />
            </span>
            <h2 className="text-2xl font-semibold text-heading">
              Assistive communication
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Use the complete FaceSpeak and FingerSpeak studios, speech
              support, live curves, calibration, and caregiver setup.
            </p>
            <nav
              aria-label="Complete assistive modules"
              className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-brand"
            >
              {modules.map(({ key, label }) => (
                <a
                  key={key}
                  href={"/assistive.html?module=" + key}
                  className="rounded-sm underline-offset-4 hover:underline"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-auto pt-7">
              <a href="/assistive.html" className={buttonClass()}>
                Open assistive app <ArrowIcon size={17} />
              </a>
            </div>
          </section>
        </div>

        <section
          className="mt-5 flex flex-col gap-5 rounded-3xl border border-line bg-white p-7 sm:flex-row sm:items-center sm:p-8"
          aria-labelledby="caregiver-title"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <UsersIcon size={25} />
          </span>
          <div className="flex-1">
            <h2
              id="caregiver-title"
              className="text-xl font-semibold text-heading"
            >
              Caring for someone?
            </h2>
            <p className="mt-1 leading-relaxed text-muted">
              Set up a private care circle, review abilities, and follow
              confirmed requests.
            </p>
          </div>
          <a
            href="/assistive.html?role=caregiver"
            className={buttonClass("secondary")}
          >
            Open caregiver view <ArrowIcon size={17} />
          </a>
        </section>

        <section
          className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 px-1 text-sm"
          aria-label="Dashboard views"
        >
          <span className="text-muted">Prefer a dashboard view?</span>
          <Link
            href="/dashboard/patient"
            className="rounded-sm font-medium text-brand hover:underline"
          >
            Patient dashboard
          </Link>
          <Link
            href="/dashboard/caregiver"
            className="rounded-sm font-medium text-brand hover:underline"
          >
            Caregiver dashboard
          </Link>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 pb-8 text-xs text-muted sm:px-8">
        <p>Camera access starts only when you choose it in a workspace.</p>
        <a
          href="https://asha-neurobridge-website.vercel.app/"
          className="rounded-sm hover:text-brand"
        >
          Visit the Asha website ↗
        </a>
      </footer>
    </div>
  );
}
