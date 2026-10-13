// The ActionSuggestion wire parser.
// The fixture is the exact shape GET .../transcript_suggestions?target=action returns.

import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  DueSource,
  parseActionSuggestion,
  serializeActionEdits,
  UndatedReason,
} from "@/types/transcript-suggestion";
import { SpeakerRole } from "@/types/transcription";
import { Some, None } from "@/types/option";

const wireActionSuggestion = () => ({
  id: "sug-1",
  coaching_session_id: "s-1",
  proposal: {
    id: "00000000-0000-0000-0000-000000000000",
    coaching_session_id: "s-1",
    goal_id: null,
    body: "Send the hiring plan to Dana",
    user_id: "coach-1",
    status: "NotStarted",
    status_changed_at: "2026-10-11T15:00:00Z",
    due_by: "2026-10-17T00:00:00Z",
    created_at: "2026-10-11T15:00:00Z",
    updated_at: "2026-10-11T15:00:00Z",
    assignee_ids: ["coachee-1"],
    due_phrase: "by Friday",
  },
  quote: "I'll send Dana the hiring plan by Friday.",
  segment: {
    id: "seg-9",
    start_ms: 754000,
    speaker_role: "coachee",
    speaker_label: "Caleb Bourg",
  },
  duplicate_of: { action_id: "act-3", body: "Share hiring plan" },
  default_due: { at: "2026-10-18T15:00:00Z", source: "next_session" },
  created_at: "2026-10-11T15:05:00Z",
});

describe("parseActionSuggestion", () => {
  it("parses the real wire shape into domain types", () => {
    const s = parseActionSuggestion(wireActionSuggestion());

    expect(s.id).toBe("sug-1");
    expect(s.coaching_session_id).toBe("s-1");
    expect(s.quote).toBe("I'll send Dana the hiring plan by Friday.");
    expect(DateTime.isDateTime(s.created_at)).toBe(true);

    expect(s.proposal.body).toBe("Send the hiring plan to Dana");
    expect(s.proposal.assignee_ids).toEqual(["coachee-1"]);
    expect(s.proposal.due_phrase).toEqual(Some("by Friday"));
    expect(s.proposal.goal_id).toEqual(None);
    expect(s.proposal.due_by.some).toBe(true);
    expect(
      s.proposal.due_by.some && s.proposal.due_by.val.toUTC().toISODate()
    ).toBe("2026-10-17");

    expect(s.segment).toEqual({
      id: "seg-9",
      start_ms: 754000,
      speaker_role: Some(SpeakerRole.Coachee),
      speaker_label: "Caleb Bourg",
    });

    expect(s.duplicate_of).toEqual(
      Some({ action_id: "act-3", body: Some("Share hiring plan") })
    );

    expect(s.default_due.source).toEqual(Some(DueSource.NextSession));
    expect(DateTime.isDateTime(s.default_due.at)).toBe(true);
    expect(s.default_due.at.toUTC().toISO()).toBe("2026-10-18T15:00:00.000Z");
  });

  it("maps null optionals to None", () => {
    const wire = wireActionSuggestion();
    wire.proposal.due_by = null as unknown as string;
    wire.proposal.due_phrase = null as unknown as string;
    wire.segment.speaker_role = null as unknown as string;
    (wire as Record<string, unknown>).duplicate_of = null;
    wire.default_due.source = "seven_days";

    const s = parseActionSuggestion(wire);

    expect(s.proposal.due_by).toEqual(None);
    expect(s.proposal.due_phrase).toEqual(None);
    expect(s.segment.speaker_role).toEqual(None);
    expect(s.duplicate_of).toEqual(None);
    expect(s.default_due.source).toEqual(Some(DueSource.SevenDays));
  });

  it("reads the new default source and the undated reasons", () => {
    const wire = wireActionSuggestion() as Record<string, unknown> & {
      default_due: { source: string };
    };
    wire.default_due.source = "week_after_session";
    wire.undated_reason = "no_next_session";
    const s = parseActionSuggestion(wire);
    expect(s.default_due.source).toEqual(Some(DueSource.WeekAfterSession));
    expect(s.undated_reason).toEqual(Some(UndatedReason.NoNextSession));

    wire.undated_reason = "not_a_date";
    expect(parseActionSuggestion(wire).undated_reason).toEqual(Some(UndatedReason.NotADate));
  });

  it("reads a missing, null or unknown undated_reason as None", () => {
    const wire = wireActionSuggestion() as Record<string, unknown>;
    delete wire.undated_reason;
    expect(parseActionSuggestion(wire).undated_reason).toEqual(None);
    for (const value of [null, "someday"]) {
      wire.undated_reason = value;
      expect(parseActionSuggestion(wire).undated_reason).toEqual(None);
    }
  });

  it("treats a missing duplicate_of as None", () => {
    const wire = wireActionSuggestion() as Record<string, unknown>;
    delete wire.duplicate_of;
    expect(parseActionSuggestion(wire).duplicate_of).toEqual(None);
  });

  it("rejects a non-object", () => {
    expect(() => parseActionSuggestion(null)).toThrow();
    expect(() => parseActionSuggestion("sug-1")).toThrow();
  });

  it("reads an unknown default_due source as None instead of failing the list", () => {
    const wire = wireActionSuggestion();
    wire.default_due.source = "someday";
    expect(parseActionSuggestion(wire).default_due.source).toEqual(None);
  });

  it("rejects a proposal that is not an action", () => {
    const wire = wireActionSuggestion();
    wire.proposal.status = "Bogus";
    expect(() => parseActionSuggestion(wire)).toThrow();
  });

  it("rejects a segment without an id", () => {
    const wire = wireActionSuggestion() as Record<string, unknown>;
    wire.segment = { start_ms: 1, speaker_role: null, speaker_label: "Guest 1" };
    expect(() => parseActionSuggestion(wire)).toThrow();
  });

  it("rejects a missing quote", () => {
    const wire = wireActionSuggestion() as Record<string, unknown>;
    delete wire.quote;
    expect(() => parseActionSuggestion(wire)).toThrow();
  });
});

describe("serializeActionEdits", () => {
  it("writes the accept body with an ISO due date", () => {
    const due = DateTime.fromISO("2026-10-17T00:00:00Z", { zone: "utc" });
    expect(
      serializeActionEdits({
        body: "Send it",
        due_by: Some(due),
        assignee_ids: ["coach-1", "coachee-1"],
        goal_id: Some("goal-1"),
      })
    ).toEqual({
      body: "Send it",
      due_by: due.toISO(),
      assignee_ids: ["coach-1", "coachee-1"],
      goal_id: "goal-1",
    });
  });

  it("writes null when there is no due date", () => {
    expect(
      serializeActionEdits({ body: "Send it", due_by: None, assignee_ids: [], goal_id: None })
    ).toEqual({ body: "Send it", due_by: null, assignee_ids: [], goal_id: null });
  });
});
