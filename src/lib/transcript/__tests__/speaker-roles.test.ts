import { describe, it, expect } from "vitest";

import {
  blockedReasonFor,
  downloadScopeFor,
} from "@/lib/transcript/speaker-roles";
import { None, Some } from "@/types/option";
import { SpeakerRole, type Speaker } from "@/types/transcription";

const coach: Speaker = { label: "Jim H", role: Some(SpeakerRole.Coach) };
const coachee: Speaker = { label: "Caleb Bourg", role: Some(SpeakerRole.Coachee) };
const unmatched: Speaker = { label: "Speaker A", role: None };

const SPEAKERS = [coach, coachee, unmatched];

describe("downloadScopeFor", () => {
  it('maps the "all" sentinel to the unfiltered scope', () => {
    expect(downloadScopeFor("all", SPEAKERS, true)).toEqual({ kind: "all" });
  });

  it("maps a matched label to its role", () => {
    expect(downloadScopeFor("Jim H", SPEAKERS, true)).toEqual({
      kind: "role",
      role: SpeakerRole.Coach,
    });
    expect(downloadScopeFor("Caleb Bourg", SPEAKERS, true)).toEqual({
      kind: "role",
      role: SpeakerRole.Coachee,
    });
  });

  it("maps a label with no role to unmapped rather than guessing by position", () => {
    expect(downloadScopeFor("Speaker A", SPEAKERS, true)).toEqual({
      kind: "unmapped",
      label: "Speaker A",
    });
  });

  it("treats a label absent from the list as unmapped, not a crash", () => {
    expect(downloadScopeFor("Nobody", SPEAKERS, true)).toEqual({
      kind: "unmapped",
      label: "Nobody",
    });
  });

  it('keeps "all" downloadable while the speakers list is unavailable', () => {
    expect(downloadScopeFor("all", [], false)).toEqual({ kind: "all" });
  });

  it("blocks a specific label while the speakers list is unavailable", () => {
    expect(downloadScopeFor("Jim H", [], false)).toEqual({
      kind: "speakers-unavailable",
    });
  });
});

describe("blockedReasonFor", () => {
  it("allows the downloadable scopes", () => {
    expect(blockedReasonFor({ kind: "all" })).toEqual(None);
    expect(
      blockedReasonFor({ kind: "role", role: SpeakerRole.Coach })
    ).toEqual(None);
  });

  it("gives one actionable message for both blocked scopes", () => {
    const unmappedReason = blockedReasonFor({
      kind: "unmapped",
      label: "Speaker A",
    });
    const unavailableReason = blockedReasonFor({ kind: "speakers-unavailable" });

    expect(unmappedReason).toEqual(Some("Switch to All to download"));
    expect(unavailableReason).toEqual(unmappedReason);
  });

  it("never names the speaker or the backend in user-facing copy", () => {
    const reason = blockedReasonFor({ kind: "unmapped", label: "Speaker A" });
    expect(reason.some && reason.val).not.toContain("Speaker A");
  });
});
