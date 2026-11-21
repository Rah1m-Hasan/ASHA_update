import { cn } from "@/lib/cn";

const spacing = {
  sm: "py-16 sm:py-20",
  md: "py-20 sm:py-28",
  lg: "py-24 sm:py-36",
};
const tones = {
  white: "bg-canvas",
  wash: "bg-wash",
  brand: "bg-brand-soft",
  pale: "bg-brand-pale",
  mist: "bg-mist",
};

export function Section({
  id,
  label,
  tone = "white",
  space = "md",
  className,
  children,
}: {
  id?: string;
  /** Accessible name for a section that has no visible heading. */
  label?: string;
  tone?: keyof typeof tones;
  space?: keyof typeof spacing;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-label={label} className={cn("scroll-mt-20", tones[tone], spacing[space], className)}>
      {children}
    </section>
  );
}
