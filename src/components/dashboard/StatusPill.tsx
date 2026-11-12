import { cn } from "@/lib/cn";

export type Tone = "neutral" | "good" | "warn" | "alert" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-wash text-muted ring-line",
  good: "bg-good-soft text-good ring-good-line",
  warn: "bg-warn-soft text-warn ring-warn-line",
  alert: "bg-danger-soft text-danger ring-danger-line",
  brand: "bg-brand-soft text-brand ring-brand-mint",
};
const dots: Record<Tone, string> = {
  neutral: "bg-muted/60",
  good: "bg-good-strong",
  warn: "bg-warn-strong",
  alert: "bg-danger-strong",
  brand: "bg-brand",
};

export function StatusPill({ tone = "neutral", pulse, children, className }: { tone?: Tone; pulse?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1", tones[tone], className)}>
      <span className={cn("size-1.5 rounded-full", dots[tone], pulse && "animate-pulse")} />
      {children}
    </span>
  );
}
