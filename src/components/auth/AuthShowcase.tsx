import Image from "next/image";
import Link from "next/link";
import { CheckIcon, EyeIcon, HandIcon, MicIcon } from "@/components/ui/icons";

export type ShowcaseCopy = { eyebrow: string; title: string; text: string };

const signals = [
  { icon: EyeIcon, label: "Blink" },
  { icon: HandIcon, label: "Gesture" },
  { icon: MicIcon, label: "Speech" },
];

/** Left half of the auth screens: a product illustration built from Asha's own UI pieces. */
export function AuthShowcase({ copy }: { copy: ShowcaseCopy }) {
  return (
    <aside className="relative hidden overflow-hidden bg-brand text-white lg:flex lg:flex-col">
      {/* Soft light + grid backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_20%_0%,#60a5fa_0%,transparent_60%),radial-gradient(70%_50%_at_100%_100%,#1d4ed8_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(#ffffff10_1px,transparent_1px),linear-gradient(90deg,#ffffff10_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_45%,#000,transparent)]" />

      <div className="relative flex h-full flex-col px-12 py-10 xl:px-16">
        <Link
          href="/"
          aria-label="Asha home"
          className="inline-flex w-fit rounded-xl bg-white px-3 py-2"
        >
          <Image
            src="/assets/brand/asha-wordmark-light.png" style={{ width: "auto" }}
            alt="Asha"
            width={144}
            height={24}
            className="h-6 w-auto"
            priority
          />
        </Link>

        <ShowcaseScene />

        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-wide text-white/70 uppercase">
            {copy.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl leading-[1.1] font-medium tracking-tight text-balance">
            {copy.title}
          </h2>
          <p className="mt-4 text-lg leading-7 text-white/80">{copy.text}</p>
        </div>
      </div>
    </aside>
  );
}

function ShowcaseScene() {
  return (
    <div
      className="relative mx-auto my-auto w-full max-w-[460px] py-10"
      aria-hidden="true"
    >
      {/* Signal rings around the companion */}
      <div className="relative mx-auto grid size-64 place-items-center">
        <span className="absolute inset-0 rounded-full border border-white/20" />
        <span className="absolute inset-6 rounded-full border border-white/25" />
        <span className="absolute inset-12 rounded-full bg-white/10" />
        <Image
          src="/assets/assets/images/asha-avatar.png"
          alt=""
          width={144}
          height={144}
          className="relative size-32 rounded-full object-cover ring-8 ring-white/90"
        />
        {/* Input signals orbiting */}
        {signals.map(({ icon: Icon, label }, i) => (
          <span
            key={label}
            className={[
              "absolute flex items-center gap-2 rounded-full bg-white py-1.5 pr-3 pl-1.5 text-sm font-medium text-ink shadow-float",
              [
                "-top-1 -left-10",
                "top-1/2 -right-16 -translate-y-1/2",
                "-bottom-1 -left-6",
              ][i],
            ].join(" ")}
          >
            <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon size={15} />
            </span>
            {label}
          </span>
        ))}
      </div>

      <p className="mt-8 text-center text-xs font-medium text-white/75">
        Example care conversation
      </p>
      {/* Request → acknowledgement */}
      <div className="mt-10 space-y-3">
        <div className="ml-auto w-fit max-w-[300px] rounded-2xl rounded-br-md bg-white px-4 py-3 text-ink shadow-float">
          <p className="text-xs font-semibold text-brand uppercase">
            Patient · confirmed
          </p>
          <p className="mt-1 font-medium">“I’d like some water.”</p>
          <p lang="bn" className="text-sm text-muted">
            আমি পানি চাই
          </p>
        </div>
        <div className="flex w-fit max-w-[300px] items-center gap-3 rounded-2xl rounded-bl-md bg-white/15 px-4 py-3 ring-1 ring-white/25 backdrop-blur-md">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-brand">
            <CheckIcon size={16} />
          </span>
          <span className="text-sm">
            <span className="block font-medium">“I’m on my way.”</span>
            <span className="text-white/75">Caregiver acknowledged</span>
          </span>
        </div>
      </div>

      {/* Signal waveform */}
      <svg
        className="mt-8 h-12 w-full text-white/60"
        viewBox="0 0 460 48"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M0 24h70l10-14 12 30 12-22 8 6h80l10-16 14 34 12-26 8 8h90l10-12 12 26 10-18 8 6h84"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
