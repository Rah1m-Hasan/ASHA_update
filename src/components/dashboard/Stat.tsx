import { cn } from "@/lib/cn";

/** A single labelled reading. `value` stays visually dominant; `hint` explains it. */
export function Stat({ label, value, unit, hint, className }: { label: string; value: React.ReactNode; unit?: string; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-white p-4 ring-1 ring-line", className)}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
