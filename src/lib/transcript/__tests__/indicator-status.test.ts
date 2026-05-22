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

describe("deriveIndicatorStatus — live recording", () => {
  it("returns Recording when the bot is actively recording", () => {
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Recording,
      })
    ).toBe(IndicatorStatus.Recording);
  });

  it("does not pulse during non-Recording live states (joining/in-meeting/processing)", () => {
    const quietLiveStates: MeetingRecordingStatus[] = [
      MeetingRecordingStatus.Joining,
      MeetingRecordingStatus.WaitingRoom,
      MeetingRecordingStatus.InMeeting,
      MeetingRecordingStatus.Processing,
    ];
    for (const status of quietLiveStates) {
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

  it("recording=Recording takes priority over transcript=Completed (e.g. re-recording a session)", () => {
    expect(
      deriveIndicatorStatus({
        recordingStatus: MeetingRecordingStatus.Recording,
        transcriptionStatus: TranscriptionStatus.Completed,
      })
    ).toBe(IndicatorStatus.Recording);
  });
});
