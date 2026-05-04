"use client";

import { AlertCircle } from "lucide-react";

import { cn } from "@/components/lib/utils";
import { IndicatorStatus } from "@/lib/transcript/indicator-status";

interface TranscriptStatusIndicatorProps {
  status: IndicatorStatus;
  /** Optional extra classes for absolute positioning on a parent icon. */
  className?: string;
}

/**
 * The dot/glyph rendered on top of the transcript toggle button.
 *
 * Three visible states:
 *   - Recording       → slow-pulsing red dot
 *   - TranscriptReady → solid green dot
 *   - Failed          → small amber ! glyph
 *
 * Renders nothing for `None`.
 *
 * The indicator is decorative (`aria-hidden`); the button's tooltip
 * carries the authoritative text description.
 */
export function TranscriptStatusIndicator({
  status,
  className,
}: TranscriptStatusIndicatorProps) {
  if (status === IndicatorStatus.None) return null;

  if (status === IndicatorStatus.Failed) {
    return (
      <AlertCircle
        aria-hidden="true"
        className={cn(
          "h-2.5 w-2.5 text-amber-500 dark:text-amber-400",
          className
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-2 w-2 rounded-full",
        dotColorClass(status),
        status === IndicatorStatus.Recording && "motion-safe:animate-pulse",
        className
      )}
    />
  );
}

function dotColorClass(status: IndicatorStatus): string {
  if (status === IndicatorStatus.Recording) return "bg-red-500";
  if (status === IndicatorStatus.TranscriptReady) return "bg-emerald-500";
  return "";
}
