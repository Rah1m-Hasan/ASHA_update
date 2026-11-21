import { cn } from "@/lib/cn";
import { Eyebrow } from "./Eyebrow";

export function SectionHeading({
  eyebrow,
  title,
  lead,
  level = 2,
  align = "center",
  layout = "stack",
  className,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  level?: 1 | 2;
  align?: "center" | "left";
  /**
   * "stack" puts the lead directly under the title.
   * "split" is the editorial two-column header: title on the left, lead on the right.
   */
  layout?: "stack" | "split";
  className?: string;
  children?: React.ReactNode;
}) {
  const Tag = level === 1 ? "h1" : "h2";
  const titleClass = cn(
    "font-medium text-balance text-display",
    level === 1
      ? "text-[clamp(2.5rem,4.6vw,3.25rem)] leading-[1.02] tracking-[-0.022em]"
      : "text-[clamp(2rem,3.6vw,3.125rem)] leading-[1.06] tracking-[-0.015em]",
  );

  if (layout === "split") {
    return (
      <div
        className={cn(
          "grid gap-y-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-x-16",
          className,
        )}
      >
        {eyebrow && (
          <Eyebrow className="w-fit justify-self-start lg:col-start-1 lg:row-start-1">
            {eyebrow}
          </Eyebrow>
        )}
        <Tag className={cn(titleClass, "lg:col-start-1 lg:row-start-2")}>{title}</Tag>
        {lead && (
          <p
            className={cn(
              "max-w-[46ch] text-[clamp(1.0625rem,1.3vw,1.25rem)] leading-[1.65] text-body",
              "lg:col-start-2 lg:row-start-2 lg:self-start lg:pt-3",
            )}
          >
            {lead}
          </p>
        )}
        {children && <div className="lg:col-start-1 lg:row-start-3">{children}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-[680px] text-center" : "max-w-[680px] text-left",
        className,
      )}
    >
      {eyebrow && (
        <Eyebrow className={cn("mb-6", align === "center" && "justify-center")}>{eyebrow}</Eyebrow>
      )}
      <Tag className={titleClass}>{title}</Tag>
      {lead && (
        <p
          className={cn(
            "mt-6 text-[clamp(1.0625rem,1.3vw,1.25rem)] leading-[1.65] text-body",
            align === "center" && "mx-auto",
          )}
        >
          {lead}
        </p>
      )}
      {children}
    </div>
  );
}
