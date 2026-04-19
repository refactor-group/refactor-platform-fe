import { MeetingRecordingStatus } from "@/types/meeting-recording";
import { TranscriptionStatus } from "@/types/transcription";

/**
 * The three visual states the transcript toggle button supports, plus
 * `none` for when nothing relevant is happening.
 *
 * See the implementation plan: only red (active recording), green
 * (transcript ready), and ! (failure) are exposed. Intermediate states
 * like "joining the meeting" or "transcript processing" render without
 * an indicator; the tooltip carries the text nuance.
 */
export enum IndicatorStatus {
  None = "none",
  Recording = "recording",
  TranscriptReady = "transcript-ready",
  Failed = "failed",
}

interface DeriveInput {
  recordingStatus?: MeetingRecordingStatus;
  transcriptionStatus?: TranscriptionStatus;
}

/**
 * Collapses the combination of recording and transcription statuses
 * into a single indicator state. Failures take priority over live
 * states, which take priority over ready states.
 */
export function deriveIndicatorStatus({
  recordingStatus,
  transcriptionStatus,
}: DeriveInput): IndicatorStatus {
  if (isFailure(recordingStatus, transcriptionStatus)) {
    return IndicatorStatus.Failed;
  }
  if (recordingStatus === MeetingRecordingStatus.Recording) {
    return IndicatorStatus.Recording;
  }
  if (transcriptionStatus === TranscriptionStatus.Completed) {
    return IndicatorStatus.TranscriptReady;
  }
  return IndicatorStatus.None;
}

function isFailure(
  recordingStatus?: MeetingRecordingStatus,
  transcriptionStatus?: TranscriptionStatus
): boolean {
  return (
    recordingStatus === MeetingRecordingStatus.Failed ||
    transcriptionStatus === TranscriptionStatus.Failed
  );
}
