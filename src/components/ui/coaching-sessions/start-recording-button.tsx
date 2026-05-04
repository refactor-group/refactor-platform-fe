"use client";

import { Disc, Loader2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import {
  MeetingRecordingStatus,
  isRecordingInProgress,
} from "@/types/meeting-recording";
import type { Id } from "@/types/general";
import { toast } from "sonner";

interface StartRecordingButtonProps {
  sessionId: Id | null;
  meetingUrl?: string;
}

export function StartRecordingButton({
  sessionId,
  meetingUrl,
}: StartRecordingButtonProps) {
  const { recording, startRecording, stopRecording } =
    useMeetingRecording(sessionId);

  const status = recording?.status;
  const inProgress = status !== undefined && isRecordingInProgress(status);
  const isProcessing = status === MeetingRecordingStatus.Processing;
  const isLive = inProgress && !isProcessing;

  const handleStart = async () => {
    if (!meetingUrl) return;
    try {
      await startRecording(meetingUrl);
    } catch {
      toast.error("Failed to start recording.");
    }
  };

  const handleStop = async () => {
    try {
      await stopRecording();
    } catch {
      toast.error("Failed to stop recording.");
    }
  };

  if (isProcessing) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled className="h-10 w-10">
              <Loader2 className="!h-6 !w-6 animate-spin text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Processing recording…</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isLive) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handleStop}
            >
              <StopCircle className="!h-6 !w-6 text-red-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Stop Recording</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            disabled={!meetingUrl}
            onClick={handleStart}
          >
            <Disc
              className={`!h-6 !w-6 ${
                !meetingUrl ? "text-muted-foreground opacity-50" : ""
              }`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{meetingUrl ? "Start Recording" : "No meeting URL configured"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
