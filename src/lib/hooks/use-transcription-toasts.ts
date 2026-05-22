"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import { useTranscription } from "@/lib/api/transcriptions";
import { MeetingRecordingStatus } from "@/types/meeting-recording";
import { TranscriptionStatus } from "@/types/transcription";
import { usePrevious } from "@/lib/hooks/use-previous";
import { useUiPreferencesStore } from "@/lib/providers/ui-preferences-state-store-provider";
import type { Id } from "@/types/general";

interface UseTranscriptionToastsArgs {
  sessionId: Id | null;
  onOpenTranscript: () => void;
  onRetryTranscription?: () => void;
}

/**
 * Mounts at the coaching-session page level. Watches recording and
 * transcription statuses and fires sonner toasts on edges:
 *   - non-Completed → Completed transcription: 15s success toast with View
 *   - any → Failed (recording or transcription): persistent error toast
 *
 * The `prev === undefined` guard suppresses spurious "ready" toasts on
 * initial mount when the transcript was already complete server-side
 * (page reload). The viewedTranscripts gate suppresses re-firing once
 * the user has acknowledged a transcript by opening the panel.
 */
export function useTranscriptionToasts({
  sessionId,
  onOpenTranscript,
  onRetryTranscription,
}: UseTranscriptionToastsArgs) {
  const { recording } = useMeetingRecording(sessionId);
  const { transcription } = useTranscription(sessionId);

  const recordingStatus = recording?.status;
  const transcriptionStatus = transcription?.status;
  const transcriptionId = transcription?.id;

  const prevRecordingStatus = usePrevious(recordingStatus);
  const prevTranscriptionStatus = usePrevious(transcriptionStatus);

  const viewedTranscripts = useUiPreferencesStore(
    (s) => s.viewedTranscripts
  );

  useEffect(() => {
    if (!sessionId) return;

    // Transcription ready: fire only on edge into Completed.
    if (
      prevTranscriptionStatus !== undefined &&
      prevTranscriptionStatus !== TranscriptionStatus.Completed &&
      transcriptionStatus === TranscriptionStatus.Completed &&
      transcriptionId !== undefined &&
      viewedTranscripts[sessionId] !== transcriptionId
    ) {
      toast.success("Transcript ready", {
        id: `transcript-ready-${sessionId}`,
        duration: 15_000,
        description: "Your coaching session transcript is ready to view.",
        action: {
          label: "View",
          onClick: () => onOpenTranscript(),
        },
      });
    }
  }, [
    sessionId,
    transcriptionId,
    transcriptionStatus,
    prevTranscriptionStatus,
    viewedTranscripts,
    onOpenTranscript,
  ]);

  useEffect(() => {
    if (!sessionId) return;

    if (
      prevRecordingStatus !== undefined &&
      prevRecordingStatus !== MeetingRecordingStatus.Failed &&
      recordingStatus === MeetingRecordingStatus.Failed
    ) {
      toast.error("Recording failed", {
        id: `recording-failed-${sessionId}`,
        duration: Infinity,
        description:
          recording?.error_message ??
          "The recording bot couldn't complete this session.",
        ...(onRetryTranscription
          ? { action: { label: "Retry", onClick: onRetryTranscription } }
          : {}),
      });
    }
    // `recording?.error_message` intentionally omitted — this effect only
    // fires on the edge into Failed, so a later refinement of the error
    // string shouldn't re-fire the toast (the prev→curr transition is
    // Failed→Failed at that point). The message is read at toast time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    recordingStatus,
    prevRecordingStatus,
    onRetryTranscription,
  ]);

  useEffect(() => {
    if (!sessionId) return;

    if (
      prevTranscriptionStatus !== undefined &&
      prevTranscriptionStatus !== TranscriptionStatus.Failed &&
      transcriptionStatus === TranscriptionStatus.Failed
    ) {
      toast.error("Transcription failed", {
        id: `transcription-failed-${sessionId}`,
        duration: Infinity,
        description:
          transcription?.error_message ??
          "We couldn't generate a transcript for this session.",
        ...(onRetryTranscription
          ? { action: { label: "Retry", onClick: onRetryTranscription } }
          : {}),
      });
    }
    // `transcription?.error_message` intentionally omitted — see the
    // analogous comment in the recording-failed effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    transcriptionStatus,
    prevTranscriptionStatus,
    onRetryTranscription,
  ]);
}
