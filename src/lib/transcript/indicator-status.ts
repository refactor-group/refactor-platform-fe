import { MeetingRecordingStatus } from "@/types/meeting-recording";
import { TranscriptionStatus } from "@/types/transcription";

// Transcript-toggle button states. Live "recording in progress" lives on
// the camera/join button (see [[issue 404]]), not on the transcript toggle.
export enum IndicatorStatus {
  None = "none",
  TranscriptReady = "transcript-ready",
  Failed = "failed",
}

interface DeriveInput {
  recordingStatus?: MeetingRecordingStatus;
  transcriptionStatus?: TranscriptionStatus;
}

export function deriveIndicatorStatus({
  recordingStatus,
  transcriptionStatus,
}: DeriveInput): IndicatorStatus {
  if (isFailure(recordingStatus, transcriptionStatus)) {
    return IndicatorStatus.Failed;
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
