import { cn } from "@/lib/cn";

/** Small titled block used for sub-features (Scape's H3 + paragraph rows). */
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
      {icon && <div className="mb-4 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</div>}
      {kicker && <p className="mb-2 text-sm font-semibold text-brand uppercase">{kicker}</p>}
      <h3 className="text-2xl leading-[1.25] font-medium text-ink">{title}</h3>
      <div className="mt-3 text-lg leading-7 text-muted">{children}</div>
    </div>
  );
}
