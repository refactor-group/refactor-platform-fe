import { describe, it, expect } from "vitest";

import { None, Some } from "@/types/option";
import {
  parseTranscriptionWithSpeakers,
  SpeakerRole,
  TranscriptionStatus,
} from "@/types/transcription";

function payload(speakers: unknown) {
  return {
    id: "t1",
    coaching_session_id: "s1",
    meeting_recording_id: "r1",
    external_id: "x1",
    status: TranscriptionStatus.Completed,
    created_at: "2026-09-21T10:00:00Z",
    updated_at: "2026-09-21T10:00:00Z",
    speakers,
  };
}

describe("parseTranscriptionWithSpeakers", () => {
  it("narrows coach and coachee roles to Some", () => {
    const parsed = parseTranscriptionWithSpeakers(
      payload([
        { label: "Jim H", role: "coach" },
        { label: "Caleb Bourg", role: "coachee" },
      ])
    );
    expect(parsed.speakers).toEqual([
      { label: "Jim H", role: Some(SpeakerRole.Coach) },
      { label: "Caleb Bourg", role: Some(SpeakerRole.Coachee) },
    ]);
  });

  // The wire sends null for a label the backend could not match. Narrowing it
  // here is what keeps null out of every caller downstream.
  it("narrows a null role to None", () => {
    const parsed = parseTranscriptionWithSpeakers(
      payload([{ label: "Speaker A", role: null }])
    );
    expect(parsed.speakers).toEqual([{ label: "Speaker A", role: None }]);
  });

  it("narrows an unrecognized role to None rather than throwing", () => {
    const parsed = parseTranscriptionWithSpeakers(
      payload([{ label: "Speaker A", role: "observer" }])
    );
    expect(parsed.speakers[0].role).toEqual(None);
  });

  it("yields an empty list when speakers is absent or not an array", () => {
    expect(parseTranscriptionWithSpeakers(payload(undefined)).speakers).toEqual([]);
    expect(parseTranscriptionWithSpeakers(payload(null)).speakers).toEqual([]);
  });

  it("preserves the transcription fields alongside the speakers", () => {
    const parsed = parseTranscriptionWithSpeakers(payload([]));
    expect(parsed.id).toBe("t1");
    expect(parsed.status).toBe(TranscriptionStatus.Completed);
  });

  it("throws on a speaker with no label, so SWR surfaces shape drift", () => {
    expect(() =>
      parseTranscriptionWithSpeakers(payload([{ role: "coach" }]))
    ).toThrow(/label/);
  });
});
