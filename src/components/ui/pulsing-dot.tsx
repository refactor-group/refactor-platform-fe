import { cn } from "@/components/lib/utils";

/**
 * A small pulsing dot indicator, useful for signaling
 * live or imminent states (e.g. a session starting soon).
 */
export function PulsingDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2 shrink-0", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/70" />
    </span>
  );
}
