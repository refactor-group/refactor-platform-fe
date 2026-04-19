"use client";

import Link from "next/link";
import { AlertCircle, Loader2, Mic, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/transcript/format-timestamp";

/**
 * Variants that describe why the transcript body can't show segments
 * yet, and the one action (if any) the user can take from each state.
 *
 * These map 1:1 to combinations of MeetingRecordingStatus and
 * TranscriptionStatus; the orchestrator in Phase 1.6 picks the right
 * variant based on current data.
 */
export type TranscriptEmptyStateVariant =
  | { kind: "no-meeting-url" }
  | { kind: "no-recording"; canStart: boolean; onStart: () => void }
  | { kind: "recording-live"; durationMs: number; onStop: () => void }
  | { kind: "processing" }
  | { kind: "recording-failed"; errorMessage?: string; onRetry: () => void }
  | { kind: "transcription-failed"; errorMessage?: string; onRetry: () => void };

interface TranscriptEmptyStateProps {
  variant: TranscriptEmptyStateVariant;
}

/**
 * Single empty-state renderer that dispatches on a discriminated-union
 * variant. Each variant stays small and focused; if any grows beyond
 * ~20 lines, extract to its own file.
 */
export function TranscriptEmptyState({ variant }: TranscriptEmptyStateProps) {
  switch (variant.kind) {
    case "no-meeting-url":
      return <NoMeetingUrl />;
    case "no-recording":
      return <NoRecording canStart={variant.canStart} onStart={variant.onStart} />;
    case "recording-live":
      return (
        <RecordingLive durationMs={variant.durationMs} onStop={variant.onStop} />
      );
    case "processing":
      return <Processing />;
    case "recording-failed":
      return (
        <Failed
          title="Recording failed"
          errorMessage={variant.errorMessage}
          onRetry={variant.onRetry}
        />
      );
    case "transcription-failed":
      return (
        <Failed
          title="Transcript generation failed"
          errorMessage={variant.errorMessage}
          onRetry={variant.onRetry}
        />
      );
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

// ── Variants ──────────────────────────────────────────────────────────

function NoMeetingUrl() {
  return (
    <Shell icon={<Video className="h-5 w-5" aria-hidden="true" />}>
      <p className="text-sm text-foreground">No meeting link set</p>
      <p className="text-xs text-muted-foreground">
        Add a Google Meet link in{" "}
        <Link
          href="/settings/integrations"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Settings → Integrations
        </Link>{" "}
        to enable recording.
      </p>
    </Shell>
  );
}

interface NoRecordingProps {
  canStart: boolean;
  onStart: () => void;
}

function NoRecording({ canStart, onStart }: NoRecordingProps) {
  return (
    <Shell icon={<Mic className="h-5 w-5" aria-hidden="true" />}>
      <p className="text-sm text-foreground">No transcript yet</p>
      <p className="text-xs text-muted-foreground">
        Record this session to capture a searchable transcript.
      </p>
      <Button
        size="sm"
        className="mt-1 gap-1.5"
        onClick={onStart}
        disabled={!canStart}
      >
        <Mic className="h-3.5 w-3.5" />
        Start recording
      </Button>
    </Shell>
  );
}

interface RecordingLiveProps {
  durationMs: number;
  onStop: () => void;
}

function RecordingLive({ durationMs, onStop }: RecordingLiveProps) {
  return (
    <Shell
      icon={
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-red-500 motion-safe:animate-pulse"
        />
      }
    >
      <p className="text-sm text-foreground">
        Recording in progress · <span className="tabular-nums">{formatTimestamp(durationMs)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Transcript will appear here after the meeting ends.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-1"
        onClick={onStop}
      >
        Stop recording
      </Button>
    </Shell>
  );
}

function Processing() {
  return (
    <Shell icon={<Loader2 className="h-5 w-5 motion-safe:animate-spin text-muted-foreground" aria-hidden="true" />}>
      <p className="text-sm text-foreground">Generating transcript…</p>
      <p className="text-xs text-muted-foreground">
        This usually takes a few minutes after the meeting ends.
      </p>
    </Shell>
  );
}

interface FailedProps {
  title: string;
  errorMessage?: string;
  onRetry: () => void;
}

function Failed({ title, errorMessage, onRetry }: FailedProps) {
  return (
    <Shell icon={<AlertCircle className="h-5 w-5 text-amber-500" aria-hidden="true" />}>
      <p className="text-sm text-foreground">{title}</p>
      {errorMessage && (
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
      )}
      <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
        Try again
      </Button>
    </Shell>
  );
}

// ── Shared layout shell ──────────────────────────────────────────────

interface ShellProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Shell({ icon, children }: ShellProps) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </div>
      {children}
    </div>
  );
}
