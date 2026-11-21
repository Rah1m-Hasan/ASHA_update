import { heroScene, storyThread } from "@/content/landing";
import { PhonePreview } from "./PhonePreview";
import { SignalLine } from "./Signal";

/**
 * The hero's product demonstration. An illustrative drawing of the Asha patient
 * space on a device, with the signal carrying a message to the care circle.
 * Nothing here is recorded footage.
 */
export function HeroScene() {
  return (
    <figure className="relative">
      <div className="relative overflow-hidden rounded-[28px] border border-line bg-brand-soft shadow-panel">
        <div aria-hidden="true" className="dot-grid absolute inset-0 opacity-80" />
        <div aria-hidden="true" className="accent-glow absolute -top-28 left-1/4 size-80 blur-2xl" />

        <div className="relative px-5 py-8 sm:px-9 sm:py-10">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[12px] font-semibold tracking-[0.16em] text-heading uppercase">
              Asha · patient space
            </span>
            <span className="inline-flex items-center gap-2 text-[12px] tracking-[0.14em] text-body uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_22%,transparent)]" />
              Care circle
            </span>
          </div>

          <div className="relative mx-auto mt-7 w-full max-w-[368px]">
            <div className="rounded-[30px] border border-line bg-surface p-2 shadow-card">
              <div className="rounded-[22px] bg-surface p-1.5 sm:-rotate-[2.5deg]">
                <PhonePreview />
              </div>
            </div>
          </div>

          <div className="mx-auto mt-7 max-w-[368px] rounded-[20px] border border-line bg-surface/90 p-4 sm:p-5">
            <p className="text-center text-[11px] font-semibold tracking-[0.12em] text-body uppercase">{heroScene.signal}</p>
            <div className="my-4 px-2">
              <SignalLine draw />
            </div>
            <div className="ml-auto max-w-[88%] rounded-[16px] rounded-tr-[5px] bg-brand-strong px-4 py-3 text-on-brand">
              <p className="text-[11px] font-medium text-on-brand/80">{storyThread.caregiverLabel}</p>
              <p className="mt-1 font-medium">{heroScene.reply}</p>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 text-center text-[14px] text-body">{heroScene.caption}</figcaption>
    </figure>
  );
}
