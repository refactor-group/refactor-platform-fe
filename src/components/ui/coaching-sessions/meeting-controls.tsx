"use client";

import { useState, useEffect } from "react";
import {
  Video,
  VideoOff,
  Circle,
  Square,
  ExternalLink,
  Lock,
  Settings,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";
import { Id } from "@/types/general";
import { AiPrivacyLevel } from "@/types/coaching-relationship";
import { RecordingStatus, formatDuration } from "@/types/meeting-recording";
import { useMeetingRecording, useMeetingRecordingMutation } from "@/lib/api/meeting-recordings";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useCurrentRelationshipRole } from "@/lib/hooks/use-current-relationship-role";
import { toast } from "sonner";
import Link from "next/link";

interface MeetingControlsProps {
  sessionId: Id;
  className?: string;
}

/**
 * Compact meeting controls dropdown for joining Google Meet and managing recording.
 * Uses a dropdown menu to save header space while providing full functionality.
 */
export function MeetingControls({ sessionId, className }: MeetingControlsProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const { recording, isLoading: recordingLoading } = useMeetingRecording(sessionId);
  const { startRecording, stopRecording } = useMeetingRecordingMutation(sessionId);
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();
  const { isCoachInCurrentRelationship } = useCurrentRelationshipRole();

  const meetingUrl = currentCoachingRelationship?.meeting_url;
  const privacyLevel = currentCoachingRelationship?.ai_privacy_level ?? AiPrivacyLevel.Full;

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (recording?.status === RecordingStatus.Recording && recording.started_at) {
      const startTime = new Date(recording.started_at).getTime();

      const updateElapsed = () => {
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - startTime) / 1000));
      };

      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recording?.status, recording?.started_at]);

  const handleStartRecording = async () => {
    setIsStarting(true);
    setIsOpen(false);
    try {
      await startRecording();
      toast.success("Recording started", {
        description: "The meeting bot is joining your call.",
      });
    } catch (error) {
      toast.error("Failed to start recording", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopRecording = async () => {
    setIsStopping(true);
    setIsOpen(false);
    try {
      await stopRecording();
      toast.success("Recording stopped", {
        description: "Your transcript will be available shortly.",
      });
    } catch (error) {
      toast.error("Failed to stop recording", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsStopping(false);
    }
  };

  const isRecordingActive = recording?.status === RecordingStatus.Recording;
  const isJoining = recording?.status === RecordingStatus.Joining;
  const isProcessing = recording?.status === RecordingStatus.Processing;
  const isCompleted = recording?.status === RecordingStatus.Completed;
  const isFailed = recording?.status === RecordingStatus.Failed;
  const aiDisabled = privacyLevel === AiPrivacyLevel.None;

  // Determine the button appearance based on state
  const getButtonContent = () => {
    if (recordingLoading || isStarting || isStopping) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <ChevronDown className="h-3 w-3 ml-1" />
        </>
      );
    }

    if (isRecordingActive) {
      return (
        <>
          <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
          <span className="text-red-600 font-medium">{formatDuration(elapsedSeconds)}</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </>
      );
    }

    if (isJoining) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Joining...</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </>
      );
    }

    if (isProcessing) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Processing</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </>
      );
    }

    if (!meetingUrl) {
      return (
        <>
          <VideoOff className="h-4 w-4 text-muted-foreground" />
          <ChevronDown className="h-3 w-3 ml-1" />
        </>
      );
    }

    if (aiDisabled) {
      return (
        <>
          <Video className="h-4 w-4" />
          <Lock className="h-3 w-3" />
          <ChevronDown className="h-3 w-3 ml-1" />
        </>
      );
    }

    return (
      <>
        <Video className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 ml-1" />
      </>
    );
  };

  return (
    <TooltipProvider>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-1", className)}
              >
                {getButtonContent()}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Meeting controls</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-56">
          {/* Meeting URL section */}
          {meetingUrl ? (
            <DropdownMenuItem asChild>
              <a
                href={meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Video className="h-4 w-4" />
                Join Google Meet
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            </DropdownMenuItem>
          ) : (
            <>
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No meeting link configured
              </div>
              {isCoachInCurrentRelationship && (
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configure in Settings
                  </Link>
                </DropdownMenuItem>
              )}
            </>
          )}

          {/* Recording controls (only if meeting URL exists and AI is not disabled) */}
          {meetingUrl && !aiDisabled && (
            <>
              <DropdownMenuSeparator />

              {isRecordingActive ? (
                <>
                  <div className="px-2 py-1.5 text-sm flex items-center gap-2">
                    <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
                    <span className="text-red-600 font-medium">
                      Recording {formatDuration(elapsedSeconds)}
                    </span>
                  </div>
                  {isCoachInCurrentRelationship && (
                    <DropdownMenuItem
                      onClick={handleStopRecording}
                      disabled={isStopping}
                      className="text-red-600"
                    >
                      <Square className="h-4 w-4 mr-2 fill-current" />
                      Stop Recording
                    </DropdownMenuItem>
                  )}
                </>
              ) : isJoining ? (
                <div className="px-2 py-1.5 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Bot joining meeting...
                </div>
              ) : isProcessing ? (
                <div className="px-2 py-1.5 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing transcript...
                </div>
              ) : isCompleted ? (
                <div className="px-2 py-1.5 text-sm flex items-center gap-2 text-muted-foreground">
                  ✓ Recorded ({formatDuration(recording?.duration_seconds ?? 0)})
                </div>
              ) : isFailed ? (
                <div className="px-2 py-1.5 text-sm text-red-600">
                  Recording failed: {recording?.error_message || "Unknown error"}
                </div>
              ) : isCoachInCurrentRelationship ? (
                <DropdownMenuItem
                  onClick={handleStartRecording}
                  disabled={isStarting}
                >
                  <Circle className="h-4 w-4 mr-2 text-red-500" />
                  Start Recording
                </DropdownMenuItem>
              ) : null}

              {/* Privacy level indicator */}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {privacyLevel === AiPrivacyLevel.TranscribeOnly
                  ? "📝 Transcript only (no video)"
                  : "🎥 Full recording with transcript"}
              </div>
            </>
          )}

          {/* AI disabled message */}
          {meetingUrl && aiDisabled && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                AI features disabled for this client
              </div>
              {isCoachInCurrentRelationship && (
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 text-xs">
                    <Settings className="h-3 w-3" />
                    Manage in Settings
                  </Link>
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
