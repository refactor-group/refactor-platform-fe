"use client";

import { useCallback } from "react";

import { useUIPreferencesStateStore } from "@/lib/providers/ui-preferences-state-store-provider";

/**
 * Convenience selector for the transcript column width and its setter.
 * Components consume this hook rather than calling into the store directly,
 * keeping them decoupled from the store-shape.
 */
export function useTranscriptPaneWidth(): {
  width: number;
  setWidth: (next: number) => void;
} {
  const width = useUIPreferencesStateStore((s) => s.transcriptPaneWidth);
  const setWidthRaw = useUIPreferencesStateStore((s) => s.setTranscriptPaneWidth);

  // Stable identity for consumers that memoize on `setWidth`.
  const setWidth = useCallback(
    (next: number) => setWidthRaw(next),
    [setWidthRaw]
  );

  return { width, setWidth };
}
