/** Lightweight wrapper for landing content that needs list-item semantics. */
export function Reveal({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "li" | "span";
  className?: string;
  children: React.ReactNode;
}) {
  return <Tag className={className}>{children}</Tag>;
}
