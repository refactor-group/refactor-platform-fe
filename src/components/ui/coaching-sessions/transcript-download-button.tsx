"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TranscriptionApi,
  type DownloadFailure,
} from "@/lib/api/transcriptions";
import { saveBlobAs } from "@/lib/download-file";
import {
  blockedReasonFor,
  type DownloadScope,
} from "@/lib/transcript/speaker-roles";
import type { Id } from "@/types/general";

interface TranscriptDownloadButtonProps {
  sessionId: Id;
  transcriptionId: Id;
  scope: DownloadScope;
}

type DownloadState = { kind: "idle" } | { kind: "downloading" };

/**
 * Header action that saves the transcript as a text file.
 *
 * Must render inside `TranscriptPanelActions`' TooltipProvider — Radix throws
 * without a provider ancestor.
 */
export function TranscriptDownloadButton({
  sessionId,
  transcriptionId,
  scope,
}: TranscriptDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>({ kind: "idle" });

  const blockedReason = blockedReasonFor(scope);
  const isDownloading = state.kind === "downloading";
  const isBlocked = blockedReason.some || isDownloading;
  const label = blockedReason.some ? blockedReason.val : "Download transcript";

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
        {/*
          aria-disabled, not disabled: a disabled button emits no pointer
          events, so the tooltip explaining why never opens.
        */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"
          onClick={isBlocked ? undefined : handleClick}
          aria-disabled={isBlocked}
          aria-label={label}
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// 401 is absent on purpose: sessionGuard's interceptor already signs the user
// out, and a toast here would race that.
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
