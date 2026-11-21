import { cn } from "@/lib/cn";

/**
 * The Asha Signal — the one recurring object on the page. A hairline that
 * carries a message, with a lit dot travelling along it.
 */
export function SignalLine({
  className,
  draw,
  onBlue,
}: {
  className?: string;
  draw?: boolean;
  /** For the blue Closing band, where the line is drawn in white. */
  onBlue?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("signal-track", draw && "signal-track--draw", onBlue && "signal-track--on-blue", className)}
    />
  );
}

/** A lit node on the signal: the place a message starts or ends. */
export function SignalNode({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("signal-node", className)} />;
}
