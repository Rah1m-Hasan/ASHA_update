import { cn } from "@/lib/cn";

export type Tone = "neutral" | "good" | "warn" | "alert" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-wash text-muted ring-line",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  alert: "bg-red-50 text-red-700 ring-red-200",
  brand: "bg-brand-soft text-brand ring-brand-mint",
};
const dots: Record<Tone, string> = {
  neutral: "bg-muted/60",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  alert: "bg-red-500",
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
