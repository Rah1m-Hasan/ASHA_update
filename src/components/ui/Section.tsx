import { cn } from "@/lib/cn";

const spacing = {
  sm: "py-16 sm:py-20",
  md: "py-20 sm:py-32",
  lg: "py-24 sm:py-40",
};
const tones = { white: "bg-canvas", wash: "bg-wash" };

export function Section({
  id,
  tone = "white",
  space = "md",
  className,
  children,
}: {
  id?: string;
  tone?: keyof typeof tones;
  space?: keyof typeof spacing;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", tones[tone], spacing[space], className)}>
      {children}
    </section>
  );
}
