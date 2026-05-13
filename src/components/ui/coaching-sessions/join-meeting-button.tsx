"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Radio, Video } from "lucide-react";
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
import { cn } from "@/components/lib/utils";
import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import { useInterval } from "@/lib/hooks/use-interval";
import {
  MeetingRecordingStatus,
  isRecordingTerminal,
} from "@/types/meeting-recording";
import { formatTimestamp } from "@/lib/transcript/format-timestamp";
import type { Id } from "@/types/general";

interface JoinMeetingButtonProps {
  sessionId: Id | null;
  meetingUrl: string | undefined;
  /**
   * Whether the current viewer is the coach for this relationship.
   * Coaches own the recording bot lifecycle (start/stop with the
   * transcription opt-in choice). Coachees just open the meeting URL —
   * they see live state for transparency but cannot start/stop.
   */
  isCoach: boolean;
}

export function JoinMeetingButton({
  sessionId,
  meetingUrl,
  isCoach,
}: JoinMeetingButtonProps) {
  const { recording, startRecording, stopRecording } =
    useMeetingRecording(sessionId);

  // Disable when either the meeting URL or session isn't available — the
  // recording lifecycle calls (startRecording/stopRecording) both require a
  // real sessionId, and the SWR fetcher's `sessionId!` non-null assertion
  // would crash if invoked without one.
  if (!meetingUrl || !sessionId) {
    return <DisabledButton />;
  }

  const status = recording?.status;

  if (status === MeetingRecordingStatus.Processing) {
    return <ProcessingButton />;
  }

  if (
    status === MeetingRecordingStatus.Pending ||
    status === MeetingRecordingStatus.Joining ||
    status === MeetingRecordingStatus.WaitingRoom
  ) {
    return <JoiningButton />;
  }

  if (
    status === MeetingRecordingStatus.InMeeting ||
    status === MeetingRecordingStatus.Recording
  ) {
    return (
      <LiveButton
        startedAt={recording?.started_at}
        onStop={
          isCoach
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

  // status is undefined OR terminal (Completed | Failed) — back to idle.
  // Note: terminal status check is structural — keep `isRecordingTerminal`
  // import to make the intent explicit even though the conditionals above
  // already cover the live/processing branches.
  const isIdle = !status || isRecordingTerminal(status);

  if (!isIdle) return null; // exhaustiveness fallback; should be unreachable

  // Coachee idle path: plain icon button, opens the meeting URL only. The
  // coach owns the bot lifecycle (consent + 409-on-double-start), so the
  // coachee never sees a transcription choice.
  if (!isCoach) {
    return (
      <CoacheeIdleButton
        onJoin={() =>
          window.open(meetingUrl, "_blank", "noopener,noreferrer")
        }
      />
    );
  }

  const handleJoinWithTranscription = () => {
    // Synchronous window.open to avoid pop-up blockers (Safari/Firefox).
    // Fire-and-forget the API call; SWR's optimistic mutate transitions
    // the button into the joining view immediately.
    window.open(meetingUrl, "_blank", "noopener,noreferrer");
    void startRecording(meetingUrl).catch((err) =>
      toast.error("Couldn't start transcription.", {
        description: err instanceof Error ? err.message : undefined,
      })
    );
  };

  const handleJoinWithoutTranscription = () => {
    window.open(meetingUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <IdleDropdownButton
      onJoinWithTranscription={handleJoinWithTranscription}
      onJoinWithoutTranscription={handleJoinWithoutTranscription}
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

interface IdleDropdownButtonProps {
  onJoinWithTranscription: () => void;
  onJoinWithoutTranscription: () => void;
}

function IdleDropdownButton({
  onJoinWithTranscription,
  onJoinWithoutTranscription,
}: IdleDropdownButtonProps) {
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

interface CoacheeIdleButtonProps {
  onJoin: () => void;
}

function CoacheeIdleButton({ onJoin }: CoacheeIdleButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label="Join meeting"
            onClick={onJoin}
          >
            <Video className="!h-6 !w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Join Meeting</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function JoiningButton() {
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
              aria-label="Joining meeting"
            >
              <Loader2 className="!h-6 !w-6 animate-spin text-muted-foreground" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Joining meeting…</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProcessingButton() {
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
              aria-label="Processing transcription"
            >
              <Loader2 className="!h-6 !w-6 animate-spin text-muted-foreground" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Processing transcription…</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LiveButtonProps {
  startedAt: string | undefined;
  /**
   * When provided (coach), the pill is interactive and clicking opens
   * the stop-confirmation dialog. When omitted (coachee), the same
   * pulsing pill renders for transparency but is non-interactive.
   */
  onStop: (() => void) | undefined;
}

function LiveButton({ startedAt, onStop }: LiveButtonProps) {
  const [open, setOpen] = useState(false);

  // Recompute duration each tick from started_at — never accumulate
  // locally (tab-throttling skews accumulators on backgrounded tabs).
  const [, setTick] = useState(0);
  useInterval(() => setTick((t) => t + 1), 1000);

  const startedMs = startedAt ? new Date(startedAt).getTime() : null;
  const durationMs =
    startedMs !== null ? Math.max(0, Date.now() - startedMs) : 0;

  const canStop = !!onStop;

  const pill = (
    <Button
      variant="outline"
      className={cn(
        "h-10 gap-1.5 border-red-500/40 bg-red-500/5 text-red-700",
        canStop
          ? "hover:bg-red-500/10 hover:text-red-800 dark:text-red-300"
          : "cursor-default hover:bg-red-500/5 hover:text-red-700 dark:text-red-300"
      )}
      onClick={canStop ? () => setOpen(true) : undefined}
      aria-label={canStop ? "Stop transcription" : "Transcription in progress"}
      aria-disabled={!canStop || undefined}
    >
      <Radio
        className="h-3.5 w-3.5 motion-safe:animate-pulse"
        fill="currentColor"
      />
      Transcribing
      <span className="tabular-nums text-xs opacity-80">
        · {formatTimestamp(durationMs)}
      </span>
    </Button>
  );

  if (!canStop) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{pill}</TooltipTrigger>
          <TooltipContent>
            <p>The coach is recording and transcribing this meeting.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      {pill}
      <AlertDialog open={open} onOpenChange={setOpen}>
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
                setOpen(false);
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
