import { describe, it, expect } from "vitest";

import {
  IndicatorStatus,
  deriveIndicatorStatus,
} from "../indicator-status";
import { MeetingRecordingStatus } from "@/types/meeting-recording";
import { TranscriptionStatus } from "@/types/transcription";

describe("deriveIndicatorStatus — failure takes precedence", () => {
  it("returns Failed when the recording failed, regardless of transcription", () => {
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Failed,
        transcriptionStatus: TranscriptionStatus.Processing,
      })
    ).toBe(IndicatorStatus.Failed);
  });

  it("returns Failed when the transcription failed, regardless of recording", () => {
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Completed,
        transcriptionStatus: TranscriptionStatus.Failed,
      })
    ).toBe(IndicatorStatus.Failed);
  });
});

// Live "Recording" state intentionally does NOT surface here — the
// pulsing red dot lives on the camera/join button (issue #404).
describe("deriveIndicatorStatus — live recording is NOT a transcript-toggle state", () => {
  it("returns None across every live/in-progress recording status", () => {
    const liveStates: MeetingRecordingStatus[] = [
      MeetingRecordingStatus.Joining,
      MeetingRecordingStatus.WaitingRoom,
      MeetingRecordingStatus.InMeeting,
      MeetingRecordingStatus.Recording,
      MeetingRecordingStatus.Processing,
    ];
    for (const status of liveStates) {
      expect(
        deriveIndicatorStatus({ recordingStatus: status })
      ).toBe(IndicatorStatus.None);
    }
  });
});

describe("deriveIndicatorStatus — transcript ready", () => {
  it("returns TranscriptReady when the transcription completed (and no failures)", () => {
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Completed,
        transcriptionStatus: TranscriptionStatus.Completed,
      })
    ).toBe(IndicatorStatus.TranscriptReady);
  });

  it("does not flash ready during transcription processing", () => {
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Completed,
        transcriptionStatus: TranscriptionStatus.Processing,
      })
    ).toBe(IndicatorStatus.None);
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Completed,
        transcriptionStatus: TranscriptionStatus.Queued,
      })
    ).toBe(IndicatorStatus.None);
  });
});

describe("deriveIndicatorStatus — default", () => {
  it("returns None when neither status is provided", () => {
    expect(deriveIndicatorStatus({})).toBe(IndicatorStatus.None);
  });

  it("returns None when nothing notable is happening", () => {
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Pending,
      })
    ).toBe(IndicatorStatus.None);
  });

  it("returns TranscriptReady when transcript completed even if recording=Recording (re-recording case)", () => {
    // Pre-#404 this returned Recording (recording took priority). Now the
    // recording state lives on the camera button, so the transcript-toggle
    // surfaces the ready-to-view artifact instead.
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Recording,
        transcriptionStatus: TranscriptionStatus.Completed,
      })
    ).toBe(IndicatorStatus.TranscriptReady);
  });
});
