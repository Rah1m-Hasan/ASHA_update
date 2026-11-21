import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "inverse" | "onBlue";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors";
const variants: Record<Variant, string> = {
  // brand-strong/on-brand carry the theme: in light they are exactly the old
  // --color-brand and white, so the dashboard and the auth pages are unchanged.
  primary: "bg-brand-strong text-on-brand hover:bg-brand-strong-hover",
  secondary: "bg-brand-soft text-brand hover:bg-brand-mint",
  ghost: "text-ink hover:bg-surface-hover rounded-lg",
  // Added for the landing page. The three above are untouched: the dashboard
  // and the auth pages use them.
  outline: "border border-brand/55 bg-brand-soft text-brand-hover hover:border-brand hover:bg-brand-mint",
  // A white pill on the Closing band — the band's one deliberate contrast
  // device. It stays white in both themes, so it keeps a dark label.
  inverse: "bg-paper text-on-white hover:bg-brand-soft",
  // For the Closing band, which is the page's one saturated blue surface.
  onBlue: "border border-paper/60 bg-paper/10 text-paper hover:border-paper hover:bg-paper/20",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
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
