"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { TRANSCRIPT_HEADER_ACTION_CLASS } from "@/components/ui/coaching-sessions/transcript-header-action";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TranscriptionApi,
  type DownloadFailure,
} from "@/lib/api/transcriptions";
import { saveBlobAs } from "@/lib/transcript/download-file";
import {
  blockedReasonFor,
  downloadLabelFor,
  type DownloadScope,
} from "@/lib/transcript/speaker-roles";
import type { Id } from "@/types/general";

interface TranscriptDownloadButtonProps {
  sessionId: Id;
  transcriptionId: Id;
  scope: DownloadScope;
}

type DownloadState = { kind: "idle" } | { kind: "downloading" };

/** Must render inside a TooltipProvider; Radix throws without one. */
export function TranscriptDownloadButton({
  sessionId,
  transcriptionId,
  scope,
}: TranscriptDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>({ kind: "idle" });

  const blockedReason = blockedReasonFor(scope);
  const isDownloading = state.kind === "downloading";
  const isBlocked = blockedReason.some || isDownloading;
  // Name states the action, tooltip states the reason: a screen reader needs
  // to know which control this is even when it is blocked.
  const actionLabel = downloadLabelFor(scope);
  const tooltipText = blockedReason.some ? blockedReason.val : actionLabel;

  async function handleClick() {
    setState({ kind: "downloading" });
    const result = await TranscriptionApi.downloadText(
      sessionId,
      transcriptionId,
      scope
    );
    setState({ kind: "idle" });

    result.match(
      (file) => saveBlobAs(file.blob, file.filename),
      (failure) =>
        toast.error("Download failed", { description: describe(failure) })
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* aria-disabled, not disabled: a disabled button opens no tooltip. */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            TRANSCRIPT_HEADER_ACTION_CLASS,
            "aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"
          )}
          onClick={isBlocked ? undefined : handleClick}
          aria-disabled={isBlocked}
          aria-label={actionLabel}
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// 401 is absent: sessionGuard's interceptor already signs the user out.
function describe(failure: DownloadFailure): string {
  if (failure.slug.some) {
    switch (failure.slug.val) {
      case "speaker_not_identified":
        return "We could not tell who said what in this transcript. Switch to All and try again.";
      case "transcription_not_completed":
        return "This transcript is still being prepared.";
      case "transcription_not_found":
        return "This transcript is no longer available.";
    }
  }
  if (failure.status.some && failure.status.val === 403) {
    return "You do not have access to this transcript.";
  }
  return "Something went wrong. Please try again.";
}
