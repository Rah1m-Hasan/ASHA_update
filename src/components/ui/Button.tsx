import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

// A button may be narrower than its label, so the label wraps between words
// rather than pushing the button out of its container. `max-w-full` is what
// lets the label wrap: without it the box grows to its longest word.
const base =
  "inline-flex max-w-full items-center justify-center gap-1.5 rounded-full font-medium text-center break-words transition-colors";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  secondary: "bg-brand-soft text-brand hover:bg-brand-mint",
  ghost: "text-ink hover:bg-wash rounded-lg",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-11 px-5 py-2 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonLinkProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  /** Use a full page load (needed when entering /app, which boots the camera engine). */
  hardNavigation?: boolean;
  external?: boolean;
};

export function ButtonLink({ href, variant, size, className, children, hardNavigation, external }: ButtonLinkProps) {
  const cls = buttonClass(variant, size, className);
  if (external)
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  if (hardNavigation)
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}
