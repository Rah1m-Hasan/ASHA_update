import { cn } from "@/lib/cn";

/**
 * A small label above a heading. A lit dot rather than a pill: the page uses
 * one accent, and the dot is the same object as the signal line.
 *
 * `as="h2"` is for the sections whose visible title *is* the eyebrow — there it
 * has to be a real heading, or the items below it skip a level.
 */
export function Eyebrow({
  as: Tag = "span",
  id,
  className,
  children,
}: {
  as?: "span" | "h2" | "h3";
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "inline-flex items-center gap-2.5 text-[13px] font-medium tracking-[0.025em] text-accent-deep",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
      />
      {children}
    </Tag>
  );
}
