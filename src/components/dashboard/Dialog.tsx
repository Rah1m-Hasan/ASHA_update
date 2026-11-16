"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** Native <dialog> wrapper: focus trapping, Escape and backdrop come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
      className={cn(
        // A tall dialog must still be reachable on a short screen, so the box is
        // capped and scrolls inside rather than running off the viewport.
        "m-auto max-h-[min(88dvh,720px)] w-[min(92vw,480px)] overflow-y-auto overscroll-contain rounded-3xl bg-surface p-0 text-ink shadow-float backdrop:bg-veil/40 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      {open && children}
    </dialog>
  );
}
