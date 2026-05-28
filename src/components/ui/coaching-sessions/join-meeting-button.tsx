"use client";

import { useState } from "react";
import { ChevronDown, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import {
  MeetingRecordingStatus,
  isRecordingTerminal,
} from "@/types/meeting-recording";
import type { Id } from "@/types/general";

interface JoinMeetingButtonProps {
  sessionId: Id | null;
  meetingUrl: string | undefined;
  /** Coach owns the bot lifecycle; coachee only opens the Meet URL. */
  isCoach: boolean;
}

export function JoinMeetingButton({
  sessionId,
  meetingUrl,
  isCoach,
}: JoinMeetingButtonProps) {
  const { recording, startRecording, stopRecording } =
    useMeetingRecording(sessionId);

  if (!meetingUrl || !sessionId) {
    return <DisabledButton />;
  }

  const openMeeting = () =>
    window.open(meetingUrl, "_blank", "noopener,noreferrer");

  const status = recording?.status;
  const isLive =
    status === MeetingRecordingStatus.InMeeting ||
    status === MeetingRecordingStatus.Recording;

  if (!isCoach) {
    return (
      <CoacheeIdleButton onJoin={openMeeting} showRecordingDot={isLive} />
    );
  }

  const isIdle = !status || isRecordingTerminal(status);

  if (isIdle) {
    const handleJoinWithTranscription = () => {
      // Synchronous window.open avoids pop-up blockers; SWR optimistic
      // mutate transitions the button to the active view.
      openMeeting();
      void startRecording(meetingUrl).catch((err) =>
        toast.error("Couldn't start transcription.", {
          description: err instanceof Error ? err.message : undefined,
        })
      );
    };
    return (
      <CoachIdleDropdownButton
        onJoinWithTranscription={handleJoinWithTranscription}
        onJoinWithoutTranscription={openMeeting}
      />
    );
  }

  return (
    <CoachActiveDropdownButton
      onOpenMeeting={openMeeting}
      showRecordingDot={isLive}
      onStop={
        isLive
          ? () =>
              stopRecording().catch((err) =>
                toast.error("Couldn't stop transcription.", {
                  description:
                    err instanceof Error ? err.message : undefined,
                })
              )
          : undefined
      }
    />
  );
}

function RecordingDot() {
  return (
    <span
      aria-hidden="true"
      data-testid="join-meeting-recording-dot"
      className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse"
    />
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────

function DisabledButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="ghost"
              size="icon"
              disabled
              className="h-10 w-10"
              aria-label="Join meeting"
            >
              <Video className="!h-6 !w-6 text-muted-foreground opacity-50" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Set up a Google Meet link in Settings → Integrations</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CoachIdleDropdownButtonProps {
  onJoinWithTranscription: () => void;
  onJoinWithoutTranscription: () => void;
}

function CoachIdleDropdownButton({
  onJoinWithTranscription,
  onJoinWithoutTranscription,
}: CoachIdleDropdownButtonProps) {
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 px-2 gap-0.5"
                aria-label="Join meeting"
              >
                <Video className="!h-6 !w-6" />
                <ChevronDown className="!h-3 !w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Join Meeting</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onSelect={onJoinWithTranscription}
          className="flex-col items-start gap-0.5"
        >
          <span className="font-medium">Join with transcription</span>
          <span className="text-xs text-muted-foreground">
            The meeting will be recorded and transcribed.
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onJoinWithoutTranscription}
          className="flex-col items-start gap-0.5"
        >
          <span className="font-medium">Join without transcription</span>
          <span className="text-xs text-muted-foreground">
            The meeting will not be recorded or transcribed.
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CoachActiveDropdownButtonProps {
  onOpenMeeting: () => void;
  showRecordingDot: boolean;
  /** When set, dropdown exposes "Stop transcription"; otherwise just "Open meeting". */
  onStop: (() => void) | undefined;
}

function CoachActiveDropdownButton({
  onOpenMeeting,
  showRecordingDot,
  onStop,
}: CoachActiveDropdownButtonProps) {
  const [stopOpen, setStopOpen] = useState(false);
  const canStop = !!onStop;

  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 px-2 gap-0.5"
                  aria-label="Join meeting"
                >
                  <Video className="!h-6 !w-6" />
                  <ChevronDown className="!h-3 !w-3 opacity-70" />
                  {showRecordingDot && <RecordingDot />}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Join Meeting</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onSelect={onOpenMeeting}
            className="flex-col items-start gap-0.5"
          >
            <span className="font-medium">Open meeting</span>
            <span className="text-xs text-muted-foreground">
              Reopen the meeting in a new tab.
            </span>
          </DropdownMenuItem>
          {canStop && (
            <DropdownMenuItem
              onSelect={() => setStopOpen(true)}
              className="flex-col items-start gap-0.5"
            >
              <span className="font-medium">Stop transcription</span>
              <span className="text-xs text-muted-foreground">
                Stop the recording and finalize the transcript.
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={stopOpen} onOpenChange={setStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop transcription?</AlertDialogTitle>
            <AlertDialogDescription>
              The bot will leave the meeting and finalize the transcript. You
              can&apos;t resume the same transcription afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep transcribing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setStopOpen(false);
                onStop?.();
              }}
            >
              Stop transcription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface CoacheeIdleButtonProps {
  onJoin: () => void;
  showRecordingDot: boolean;
}

function CoacheeIdleButton({ onJoin, showRecordingDot }: CoacheeIdleButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10"
            aria-label="Join meeting"
            onClick={onJoin}
          >
            <Video className="!h-6 !w-6" />
            {showRecordingDot && <RecordingDot />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Join Meeting</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
