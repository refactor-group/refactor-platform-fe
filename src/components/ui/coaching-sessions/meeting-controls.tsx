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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
 * Meeting controls for joining Google Meet and managing recording.
 * Shows different states based on recording status and user role.
 */
export function MeetingControls({ sessionId, className }: MeetingControlsProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  // State A: No meeting URL configured
  if (!meetingUrl) {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-2", className)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <VideoOff className="h-4 w-4" />
                <span>No meeting link</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Configure a Google Meet URL in Settings</p>
            </TooltipContent>
          </Tooltip>
          {isCoachInCurrentRelationship && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4 mr-1" />
                Configure
              </Link>
            </Button>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // State B: AI features disabled
  if (aiDisabled) {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-2", className)}>
          <Button variant="outline" size="sm" asChild>
            <a href={meetingUrl} target="_blank" rel="noopener noreferrer">
              <Video className="h-4 w-4 mr-1" />
              Join Meet
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Lock className="h-3 w-3" />
            <span>AI disabled</span>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Join Meet button */}
        <Button variant="outline" size="sm" asChild>
          <a href={meetingUrl} target="_blank" rel="noopener noreferrer">
            <Video className="h-4 w-4 mr-1" />
            Join Meet
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>

        {/* Recording status and controls */}
        {recordingLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : isJoining ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Bot joining...
            </Badge>
          </div>
        ) : isRecordingActive ? (
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <Circle className="h-2 w-2 fill-current" />
              Recording {formatDuration(elapsedSeconds)}
            </Badge>
            {isCoachInCurrentRelationship && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStopRecording}
                disabled={isStopping}
              >
                {isStopping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-1 fill-current" />
                )}
                Stop
              </Button>
            )}
          </div>
        ) : isProcessing ? (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing...
          </Badge>
        ) : isCompleted ? (
          <Badge variant="secondary" className="gap-1">
            ✓ Recorded ({formatDuration(recording?.duration_seconds ?? 0)})
          </Badge>
        ) : isFailed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive">Recording failed</Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{recording?.error_message || "An error occurred"}</p>
            </TooltipContent>
          </Tooltip>
        ) : isCoachInCurrentRelationship ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartRecording}
            disabled={isStarting}
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Circle className="h-4 w-4 mr-1 text-red-500" />
            )}
            Start Recording
          </Button>
        ) : null}

        {/* Privacy level indicator for coach */}
        {isCoachInCurrentRelationship && !isRecordingActive && !isJoining && !isProcessing && !isCompleted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground">
                {privacyLevel === AiPrivacyLevel.TranscribeOnly ? "Transcript only" : "Full recording"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {privacyLevel === AiPrivacyLevel.TranscribeOnly
                  ? "Only transcript will be generated, no video storage"
                  : "Full video recording with transcript"}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
