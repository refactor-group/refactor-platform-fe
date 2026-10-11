"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { TranscriptSuggestionApi, type ScanFailure } from "@/lib/api/transcript-suggestions";
import type { Id } from "@/types/general";

export function scanFailureMessage(f: ScanFailure): string {
  switch (f.kind) {
    case "refused":
      return f.message.some ? f.message.val : "Couldn't start the scan.";
    case "network":
      return "Couldn't start the scan. Connection to service was lost.";
    case "unexpected":
      return "Couldn't start the scan.";
    default: {
      const _exhaustive: never = f;
      throw new Error(`Unhandled scan failure: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Starts a scan of the session's transcript for suggested actions. */
export function useSuggestionScan(sessionId: Id, refresh: () => void) {
  const start = useCallback(async () => {
    const result = await TranscriptSuggestionApi.startScan(sessionId);
    if (result.isErr()) {
      toast.error(scanFailureMessage(result.error));
      // A refusal means the status shown is out of date.
      if (result.error.kind === "refused") refresh();
      return;
    }
    refresh();
  }, [sessionId, refresh]);

  return { start };
}
