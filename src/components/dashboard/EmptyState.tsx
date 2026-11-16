export function EmptyState({
  icon,
  title,
  headingLevel = 3,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  /** The empty state sits under a page heading, so it is a level below it. */
  headingLevel?: 1 | 2 | 3;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</div>}
      <Heading className="mt-4 font-semibold text-ink">{title}</Heading>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
