import { CheckIcon, SignalIcon } from "@/components/ui/icons";
import { heroScene } from "@/content/landing";
import { cn } from "@/lib/cn";

/**
 * The Asha patient space, built in HTML so it stays sharp and editable.
 * Illustrative only — this is a drawing of the interface, not a screenshot.
 */
export function PhonePreview({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[22px] bg-surface px-5 py-6 text-center sm:px-7 sm:py-8", className)}>
      <span className="text-[11px] font-semibold tracking-[0.08em] text-accent-deep">
        {heroScene.eyebrow}
      </span>
      <span className="mx-auto mt-5 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
        <SignalIcon size={24} />
      </span>
      <p className="mt-4 text-[1.375rem] leading-[1.3] font-medium text-heading">{heroScene.prompt}</p>
      <p className="mt-1.5 text-[13px] text-body">{heroScene.promptHint}</p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {heroScene.needs.map((n, i) => (
          <span
            key={n}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium",
              i === 0 ? "bg-brand-strong text-on-brand" : "border border-brand/50 bg-surface text-brand",
            )}
          >
            {n}
          </span>
        ))}
      </div>

      <div className="mt-5 inline-flex items-center gap-2 text-[13px] text-body">
        <CheckIcon size={15} className="text-brand" />
        Your choice, confirmed
      </div>
    </div>
  );
}
