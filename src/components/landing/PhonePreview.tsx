import Image from "next/image";
import { CheckIcon } from "@/components/ui/icons";
import { heroScene } from "@/content/landing";
import { cn } from "@/lib/cn";

/**
 * The Asha patient space, built in HTML so it stays sharp and editable.
 * Illustrative only — this is a drawing of the interface, not a screenshot.
 */
export function PhonePreview({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[22px] bg-surface px-5 py-6 text-center sm:px-7 sm:py-8", className)}>
      <span className="text-[11px] font-semibold tracking-[0.16em] text-accent-deep uppercase">
        {heroScene.eyebrow}
      </span>
      <Image
        src="/assets/assets/images/asha-avatar.png"
        alt=""
        width={96}
        height={96}
        className="mx-auto mt-5 size-16 rounded-full object-cover ring-6 ring-brand-soft"
      />
      <p className="mt-5 text-[1.375rem] leading-[1.3] font-medium text-heading">{heroScene.prompt}</p>
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

      <div className="mt-5 flex items-center gap-3 rounded-[14px] bg-wash px-4 py-3 text-left">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-strong text-on-brand">
          <CheckIcon size={14} />
        </span>
        <span className="text-[13px] leading-tight">
          <span className="block font-medium text-ink">{heroScene.reply}</span>
          <span className="block text-body">{heroScene.replyLabel}</span>
        </span>
      </div>
    </div>
  );
}
