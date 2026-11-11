import { cn } from "@/lib/cn";

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-brand-mint bg-brand-soft px-3 py-1 text-xs font-semibold tracking-wide text-brand uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}
