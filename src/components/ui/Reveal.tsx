import { cn } from "@/lib/cn";

/**
 * A wrapper that used to fade content in as it scrolled into view.
 *
 * The scroll-driven animation was dropped in the landing redesign, so content is
 * always visible and `stagger` currently records an offset that nothing reads.
 * The prop is kept so the call sites keep their shape; the wrapper stays so
 * the day the reveal comes back, no component has to change.
 */
export function Reveal({
  as: Tag = "div",
  className,
  stagger,
  children,
}: {
  as?: "div" | "li" | "span";
  className?: string;
  stagger?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}) {
  return (
    <Tag className={cn("reveal", className)} {...(stagger ? { "data-stagger": stagger } : {})}>
      {children}
    </Tag>
  );
}
