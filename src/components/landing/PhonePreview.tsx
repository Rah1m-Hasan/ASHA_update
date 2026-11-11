import Image from "next/image";
import { CheckIcon } from "@/components/ui/icons";

const needs = ["Water", "Comfort", "Help"];

/** Illustrative Asha patient screen (built in HTML, so it stays sharp and editable). */
export function PhonePreview() {
  return (
    <figure className="mx-auto max-w-[560px]">
      <div className="rounded-[36px] bg-gradient-to-b from-brand-mint to-brand-soft p-3 shadow-float sm:p-4">
        <div className="rounded-[28px] bg-white px-6 py-8 text-center sm:px-10">
          <span className="text-xs font-semibold tracking-wide text-brand uppercase">Your space · Here with you</span>
          <Image
            src="/assets/assets/images/asha-avatar.png"
            alt=""
            width={96}
            height={96}
            className="mx-auto mt-5 size-20 rounded-full object-cover ring-8 ring-brand-soft"
          />
          <p className="mt-5 text-2xl font-medium text-ink">“Would you like some water?”</p>
          <p className="mt-1 text-sm text-muted">Your comfortable gesture. Your choice.</p>
          <div className="mt-6 flex justify-center gap-2">
            {needs.map((n, i) => (
              <span
                key={n}
                className={
                  i === 0
                    ? "rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
                    : "rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand"
                }
              >
                {n}
              </span>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-wash px-4 py-3 text-left">
            <span className="grid size-8 place-items-center rounded-full bg-brand text-white">
              <CheckIcon size={16} />
            </span>
            <span className="text-sm">
              <span className="block font-medium text-ink">“I’m on my way.”</span>
              <span className="text-muted">Caregiver acknowledged</span>
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-muted">Illustrative communication flow</figcaption>
    </figure>
  );
}
