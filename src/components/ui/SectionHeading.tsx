import { cn } from "@/lib/cn";
import { Eyebrow } from "./Eyebrow";

export function SectionHeading({
  eyebrow,
  title,
  lead,
  level = 2,
  align = "center",
  className,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  level?: 1 | 2;
  align?: "center" | "left";
  className?: string;
  children?: React.ReactNode;
}) {
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <div className={cn(align === "center" ? "mx-auto text-center" : "text-left", "max-w-[664px]", className)}>
      {eyebrow && <Eyebrow className="mb-5">{eyebrow}</Eyebrow>}
      <Tag
        className={cn(
          "font-medium tracking-tight text-ink text-balance",
          level === 1
            ? "text-[40px] leading-[1.05] sm:text-[64px] sm:leading-[1]"
            : "text-[34px] leading-[1.15] sm:text-[48px] sm:leading-[1.25]",
        )}
      >
        {title}
      </Tag>
      {lead && (
        <p className={cn("mt-5 text-lg leading-7 text-muted sm:text-xl sm:leading-8", align === "center" && "mx-auto")}>
          {lead}
        </p>
      )}
      {children}
    </div>
  );
}
