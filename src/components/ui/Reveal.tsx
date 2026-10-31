import { cn } from "@/lib/cn";

/**
 * Fades content in as it scrolls into view using CSS scroll-driven animation.
 * Content is always visible where the feature is unsupported, without JS, or with reduced motion.
 */
export function Reveal({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "li" | "span";
  className?: string;
  children: React.ReactNode;
}) {
  return <Tag className={cn("reveal", className)}>{children}</Tag>;
}
