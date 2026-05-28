"use client";

import { AlertCircle } from "lucide-react";

import { cn } from "@/components/lib/utils";
import { IndicatorStatus } from "@/lib/transcript/indicator-status";

interface TranscriptStatusIndicatorProps {
  status: IndicatorStatus;
  className?: string;
}

// Decorative dot/glyph on the transcript-toggle button. Live recording
// indicator lives on the camera/join button (meeting-level state, not a
// transcript-artifact state).
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
      className={cn("h-2 w-2 rounded-full bg-emerald-500", className)}
    />
  );
}
