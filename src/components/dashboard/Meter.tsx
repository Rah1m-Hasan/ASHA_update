import { cn } from "@/lib/cn";

/** Horizontal 0–1 bar with label and percentage. */
export function Meter({ label, value, className }: { label: string; value: number | null | undefined; className?: string }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className={className}>
      <div className="flex justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums text-muted">{value == null ? "—" : Math.round(v * 100)}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-wash ring-1 ring-line/70">
        <div className={cn("h-full rounded-full bg-brand transition-[width] duration-150")} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}
