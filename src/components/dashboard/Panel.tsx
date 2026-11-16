import { cn } from "@/lib/cn";

/** Content container for dashboard pages. Title row is optional. */
export function Panel({
  title,
  titleLevel = 2,
  description,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  /** Heading level of the panel title. A panel that *is* the page uses 1. */
  titleLevel?: 1 | 2 | 3;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  const Title = `h${titleLevel}` as "h1" | "h2" | "h3";
  return (
    <section className={cn("rounded-2xl bg-surface ring-1 ring-line", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            {title && <Title className="text-base font-semibold text-ink">{title}</Title>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
