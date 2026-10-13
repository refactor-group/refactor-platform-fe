import { describe, it, expect } from "vitest";

import {
  blockedReasonFor,
  downloadLabelFor,
  downloadScopeFor,
} from "@/lib/utils/transcript-speaker-roles";
import { None, Some } from "@/types/option";
import { SpeakerRole, type TranscriptSegment } from "@/types/transcription";

let nextId = 0;

function segment(
  speakerLabel: string,
  role: SpeakerRole | null,
  userId: string | null,
): TranscriptSegment {
  return {
    id: `seg-${nextId++}`,
    transcription_id: "t-1",
    speaker_label: speakerLabel,
    speaker_user_id: userId === null ? None : Some(userId),
    speaker_role: role === null ? None : Some(role),
    text: "Hello.",
    start_ms: 0,
    end_ms: 1000,
    created_at: "2026-10-06T12:00:00Z",
  };
}

const SEGMENTS = [
  segment("Jim H", SpeakerRole.Coach, "coach-id"),
  segment("Caleb Bourg", SpeakerRole.Coachee, "coachee-id"),
  segment("Jim H (2)", null, null),
  segment("Guest 1", null, null),
  segment("Jim H", SpeakerRole.Coach, "coach-id"),
];

describe("downloadScopeFor", () => {
  it('maps the "all" sentinel to the unfiltered scope', () => {
    expect(downloadScopeFor("all", SEGMENTS)).toEqual({ kind: "all" });
  });

  it("maps a selected speaker to the role on their segments", () => {
    expect(downloadScopeFor("Jim H", SEGMENTS)).toEqual({
      kind: "role",
      role: SpeakerRole.Coach,
      label: "Jim H",
    });
    expect(downloadScopeFor("Caleb Bourg", SEGMENTS)).toEqual({
      kind: "role",
      role: SpeakerRole.Coachee,
      label: "Caleb Bourg",
    });
  });

  it("leaves a guest who typed the coach's name unmapped", () => {
    expect(downloadScopeFor("Jim H (2)", SEGMENTS)).toEqual({
      kind: "unmapped",
      label: "Jim H (2)",
    });
  });

  it("leaves a nameless guest unmapped", () => {
    expect(downloadScopeFor("Guest 1", SEGMENTS)).toEqual({
      kind: "unmapped",
      label: "Guest 1",
    });
  });

  it("treats a label with no segments as unmapped, not a crash", () => {
    expect(downloadScopeFor("Nobody", SEGMENTS)).toEqual({
      kind: "unmapped",
      label: "Nobody",
    });
    expect(downloadScopeFor("Jim H", [])).toEqual({
      kind: "unmapped",
      label: "Jim H",
    });
  });
});

describe("blockedReasonFor", () => {
  it("allows the downloadable scopes", () => {
    expect(blockedReasonFor({ kind: "all" })).toEqual(None);
    expect(
      blockedReasonFor({
        kind: "role",
        role: SpeakerRole.Coach,
        label: "Jim H",
      }),
    ).toEqual(None);
  });

  it("gives an actionable message for an unmapped speaker", () => {
    expect(blockedReasonFor({ kind: "unmapped", label: "Guest 1" })).toEqual(
      Some("Switch to All to download"),
    );
  });

  it("never names the speaker in user-facing copy", () => {
    const reason = blockedReasonFor({ kind: "unmapped", label: "Guest 1" });
    expect(reason.some && reason.val).not.toContain("Guest 1");
  });
});

describe("downloadLabelFor", () => {
  it("stays generic for the unfiltered scope", () => {
    expect(downloadLabelFor({ kind: "all" })).toBe("Download transcript");
  });

  it("names the speaker the panel is filtered to", () => {
    expect(
      downloadLabelFor({
        kind: "role",
        role: SpeakerRole.Coach,
        label: "Jim H",
      }),
    ).toBe("Download Jim H's transcript");
  });

  it("uses the label verbatim, including punctuation in a display name", () => {
    expect(
      downloadLabelFor({
        kind: "role",
        role: SpeakerRole.Coach,
        label: "Jim (Refactor Group)",
      }),
    ).toBe("Download Jim (Refactor Group)'s transcript");
  });

  it("stays generic for a speaker that cannot be downloaded", () => {
    expect(downloadLabelFor({ kind: "unmapped", label: "Jim H (2)" })).toBe(
      "Download transcript",
    );
  });
});
