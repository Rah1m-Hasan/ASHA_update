"use client";

import { NEEDS } from "@/features/requests/needs";
import { useRequests } from "@/features/requests/RequestProvider";
import { cn } from "@/lib/cn";

const art: Record<string, string> = { water: "💧", food: "🍲", toilet: "🚻", comfort: "🛏️", help: "🙋" };

/** Large, high-contrast request buttons. Each opens the confirmation step. */
export function NeedButtons({ size = "lg" }: { size?: "md" | "lg" }) {
  const { propose } = useRequests();
  return (
    <div className={cn("grid gap-3", size === "lg" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" : "grid-cols-2 sm:grid-cols-5")}>
      {NEEDS.map((n) => (
        <button
          key={n.kind}
          onClick={() => propose(n.kind, n.text)}
          className={cn(
            "group flex flex-col items-start rounded-2xl bg-surface text-left ring-1 ring-line transition hover:ring-2 hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand",
            size === "lg" ? "min-h-36 p-5" : "min-h-24 p-4",
          )}
        >
          <span aria-hidden="true" className={size === "lg" ? "text-4xl" : "text-2xl"}>
            {art[n.kind]}
          </span>
          <span className={cn("mt-auto font-semibold text-ink", size === "lg" ? "text-xl" : "text-base")}>{n.label}</span>
          <span lang="bn" className="text-sm text-muted">
            {n.bn}
          </span>
        </button>
      ))}
    </div>
  );
}
