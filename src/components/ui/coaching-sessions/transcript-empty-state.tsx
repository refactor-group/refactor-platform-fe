"use client";

import Link from "next/link";
import { AlertCircle, Loader2, Mic, MicOff, Video } from "lucide-react";

import { formatTimestamp } from "@/lib/transcript/format-timestamp";

/**
 * Variants that describe why the transcript body can't show segments yet.
 *
 * Actions live in the header (Join Session button) and as toasts; the
 * panel itself is view-only — its variants carry no callbacks.
 */
export type TranscriptEmptyStateVariant =
  | { kind: "no-meeting-url" }
  | { kind: "no-recording" }
  | { kind: "recording-live"; durationMs: number }
  | { kind: "processing" }
  | { kind: "no-speech" }
  | { kind: "recording-failed"; errorMessage?: string }
  | { kind: "transcription-failed"; errorMessage?: string };

interface TranscriptEmptyStateProps {
  variant: TranscriptEmptyStateVariant;
}

export function TranscriptEmptyState({ variant }: TranscriptEmptyStateProps) {
  switch (variant.kind) {
    case "no-meeting-url":
      return <NoMeetingUrl />;
    case "no-recording":
      return <NoRecording />;
    case "recording-live":
      return <RecordingLive durationMs={variant.durationMs} />;
    case "processing":
      return <Processing />;
    case "no-speech":
      return <NoSpeech />;
    case "recording-failed":
      return (
        <Failed
          title="Recording failed"
          errorMessage={variant.errorMessage}
        />
      );
    case "transcription-failed":
      return (
        <Failed
          title="Transcript generation failed"
          errorMessage={variant.errorMessage}
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
        to enable transcription.
      </p>
    </Shell>
  );
}

function NoRecording() {
  return (
    <Shell icon={<Mic className="h-5 w-5" aria-hidden="true" />}>
      <p className="text-sm text-foreground">No transcript yet</p>
      <p className="text-xs text-muted-foreground">
        Use the Join Meeting button to launch the meeting and start a
        transcription.
      </p>
    </Shell>
  );
}

interface RecordingLiveProps {
  durationMs: number;
}

function RecordingLive({ durationMs }: RecordingLiveProps) {
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
        Transcription in progress ·{" "}
        <span className="tabular-nums">{formatTimestamp(durationMs)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Transcript segments will appear here after the meeting ends.
      </p>
    </Shell>
  );
}

function Processing() {
  return (
    <Shell
      icon={
        <Loader2
          className="h-5 w-5 motion-safe:animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      }
    >
      <p className="text-sm text-foreground">Generating transcript…</p>
      <p className="text-xs text-muted-foreground">
        This usually takes a few minutes after the meeting ends.
      </p>
    </Shell>
  );
}

function NoSpeech() {
  return (
    <Shell
      icon={
        <MicOff
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
      }
    >
      <p className="text-sm text-foreground">No speech detected</p>
      <p className="text-xs text-muted-foreground">
        The recording completed but no audio was captured. Make sure the bot
        joined while the meeting was active.
      </p>
    </Shell>
  );
}

interface FailedProps {
  title: string;
  errorMessage?: string;
}

function Failed({ title, errorMessage }: FailedProps) {
  return (
    <Shell
      icon={
        <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden="true" />
      }
    >
      <p className="text-sm text-foreground">{title}</p>
      {errorMessage && (
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
      )}
      <p className="text-xs text-muted-foreground">
        See the notification for retry options.
      </p>
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
