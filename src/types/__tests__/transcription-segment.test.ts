import { describe, it, expect } from "vitest";

import { None, Some } from "@/types/option";
import { parseTranscriptSegment, SpeakerRole } from "@/types/transcription";

function wire(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "seg-1",
    transcription_id: "t-1",
    speaker_label: "Jim H",
    speaker_user_id: "coach-id",
    speaker_role: "coach",
    text: "Good morning.",
    start_ms: 0,
    end_ms: 1500,
    confidence: 0.9,
    sentiment: "neutral",
    created_at: "2026-10-06T12:00:00Z",
    ...overrides,
  };
}

describe("parseTranscriptSegment attribution", () => {
  it("reads the speaker's user and role", () => {
    const parsed = parseTranscriptSegment(wire());

    expect(parsed.speaker_user_id).toEqual(Some("coach-id"));
    expect(parsed.speaker_role).toEqual(Some(SpeakerRole.Coach));
    expect(parsed.speaker_label).toBe("Jim H");
  });

  it("reads the coachee role", () => {
    const parsed = parseTranscriptSegment(
      wire({ speaker_user_id: "coachee-id", speaker_role: "coachee" }),
    );

    expect(parsed.speaker_role).toEqual(Some(SpeakerRole.Coachee));
  });

  it("maps null attribution to None for a guest", () => {
    const parsed = parseTranscriptSegment(
      wire({
        speaker_label: "Guest 1",
        speaker_user_id: null,
        speaker_role: null,
      }),
    );

    expect(parsed.speaker_user_id).toEqual(None);
    expect(parsed.speaker_role).toEqual(None);
  });

  it("maps missing attribution fields to None", () => {
    const {
      speaker_user_id: _u,
      speaker_role: _r,
      ...withoutAttribution
    } = wire();

    const parsed = parseTranscriptSegment(withoutAttribution);

    expect(parsed.speaker_user_id).toEqual(None);
    expect(parsed.speaker_role).toEqual(None);
  });

  it("treats an unknown role as None rather than trusting it", () => {
    const parsed = parseTranscriptSegment(wire({ speaker_role: "Coach" }));

    expect(parsed.speaker_role).toEqual(None);
  });

  it("still drops an unrecognized sentiment while keeping attribution", () => {
    const parsed = parseTranscriptSegment(wire({ sentiment: "ecstatic" }));

    expect(parsed.sentiment).toBeUndefined();
    expect(parsed.speaker_role).toEqual(Some(SpeakerRole.Coach));
  });
});
