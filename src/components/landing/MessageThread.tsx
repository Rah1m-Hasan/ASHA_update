import { storyThread } from "@/content/landing";
import { SignalLine } from "./Signal";

/** An illustrative exchange: one signal from the patient, one reply back. */
export function MessageThread() {
  return (
    <figure className="m-0">
      <div className="rounded-[24px] border border-line bg-surface p-5 shadow-card sm:p-7">
        <div className="max-w-[85%] rounded-[18px] rounded-tl-[6px] bg-brand-soft px-4 py-3.5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-accent-deep uppercase">
            {storyThread.patientLabel}
          </p>
          <p className="mt-1 text-[1.375rem] leading-[1.25] font-medium text-heading">{storyThread.patient}</p>
        </div>

        <div className="my-5 pl-3">
          <SignalLine draw />
        </div>

        <div className="ml-auto max-w-[85%] rounded-[18px] rounded-tr-[6px] bg-brand-strong px-4 py-3.5">
          {/* Full white: white/75 on the brand blue is 3.6:1, under AA at this size. */}
          <p className="text-[11px] font-semibold tracking-[0.14em] text-on-brand uppercase">
            {storyThread.caregiverLabel}
          </p>
          <p className="mt-1 text-[1.375rem] leading-[1.25] font-medium text-on-brand">{storyThread.caregiver}</p>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-[14px] text-body">{storyThread.caption}</figcaption>
    </figure>
  );
}
