import { cn } from "@/components/lib/utils";

export enum PulsingDotTone {
  Neutral = "neutral",
  Accent = "accent",
}

function toneClasses(tone: PulsingDotTone): { ring: string; dot: string } {
  switch (tone) {
    case PulsingDotTone.Neutral:
      return { ring: "bg-foreground/40", dot: "bg-foreground/70" };
    case PulsingDotTone.Accent:
      return { ring: "bg-brand/40", dot: "bg-brand" };
    default: {
      const _exhaustive: never = tone;
      throw new Error(`Unhandled tone: ${_exhaustive}`);
    }
  }
}

/**
 * A small pulsing dot indicator, useful for signaling
 * live or imminent states (e.g. a session starting soon).
 */
export function PulsingDot({
  className,
  tone = PulsingDotTone.Neutral,
}: {
  className?: string;
  tone?: PulsingDotTone;
}) {
  const { ring, dot } = toneClasses(tone);
  return (
    <span className={cn("relative flex h-2 w-2 shrink-0", className)}>
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full", ring)} />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", dot)} />
    </span>
  );
}
