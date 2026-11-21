import { cn } from "@/lib/cn";

/** A titled block with a paragraph under it — used for sub-features. */
export function FeatureItem({
  title,
  icon,
  kicker,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  /** Small label above the title, e.g. "01 / Adapt". */
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-left", className)}>
      {icon && (
        <div className="mb-5 grid size-10 place-items-center rounded-[14px] bg-brand-soft text-brand">
          {icon}
        </div>
      )}
      {kicker && (
        <p className="mb-2.5 text-[11px] font-semibold tracking-[0.16em] text-accent-deep uppercase">{kicker}</p>
      )}
      <h3 className="text-[clamp(1.375rem,2vw,1.75rem)] leading-[1.2] font-medium tracking-[-0.01em] text-heading">
        {title}
      </h3>
      <div className="mt-3 text-[1.0625rem] leading-[1.7] text-body">{children}</div>
    </div>
  );
}
