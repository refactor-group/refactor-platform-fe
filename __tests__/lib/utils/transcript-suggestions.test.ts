// Frozen acceptance test for fe#477 phase 2: who may act on a suggestion, and
// which due date a suggestion card shows.

import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { mayActOnSuggestion, suggestionDue } from "@/lib/utils/transcript-suggestions";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None, type Option } from "@/types/option";
import { createMockAction } from "../../test-utils";

const people = { coachId: "coach-1", coacheeId: "coachee-1" };
const { Coach, Coachee } = RelationshipRole;

describe("mayActOnSuggestion", () => {
  it("lets the coach act on anything, including moving the coach", () => {
    expect(mayActOnSuggestion(Coach, people, ["coach-1"], None)).toBe(true);
    expect(mayActOnSuggestion(Coach, people, [], Some(["coach-1"]))).toBe(true);
  });

  it("stops the coachee on a coach-only suggestion", () => {
    expect(mayActOnSuggestion(Coachee, people, ["coach-1"], None)).toBe(false);
  });

  it("lets the coachee act on their own, shared or unassigned suggestions", () => {
    expect(mayActOnSuggestion(Coachee, people, ["coachee-1"], None)).toBe(true);
    expect(mayActOnSuggestion(Coachee, people, ["coach-1", "coachee-1"], None)).toBe(true);
    expect(mayActOnSuggestion(Coachee, people, [], None)).toBe(true);
  });

  it("stops the coachee from adding or removing the coach", () => {
    expect(mayActOnSuggestion(Coachee, people, ["coachee-1"], Some(["coachee-1", "coach-1"]))).toBe(
      false
    );
    expect(mayActOnSuggestion(Coachee, people, ["coach-1", "coachee-1"], Some(["coachee-1"]))).toBe(
      false
    );
    expect(mayActOnSuggestion(Coachee, people, [], Some(["coach-1"]))).toBe(false);
  });

  it("lets the coachee change assignees without touching the coach", () => {
    expect(mayActOnSuggestion(Coachee, people, ["coachee-1"], Some([]))).toBe(true);
    expect(
      mayActOnSuggestion(Coachee, people, ["coach-1", "coachee-1"], Some(["coach-1", "coachee-1"]))
    ).toBe(true);
  });
});

const noon = (isoDate: string) => DateTime.fromISO(`${isoDate}T12:00:00Z`);

function suggestion(
  dueBy: Option<DateTime>,
  phrase: Option<string>,
  source: DueSource = DueSource.NextSession
): ActionSuggestion {
  return {
    id: "sug-1",
    coaching_session_id: "s-1",
    proposal: { ...createMockAction({ due_by: dueBy }), due_phrase: phrase },
    quote: "q",
    segment: { id: "seg-1", start_ms: 0, speaker_role: None, speaker_label: "Guest 1" },
    duplicate_of: None,
    default_due: { at: noon("2026-10-18"), source },
    created_at: noon("2026-10-11"),
  };
}

describe("suggestionDue", () => {
  it("shows a spoken date with its phrase in the tooltip", () => {
    const due = suggestionDue(suggestion(Some(noon("2026-10-17")), Some("by Friday")), "en-US");
    expect(due.spoken).toBe(true);
    expect(due.at.toISODate()).toBe(noon("2026-10-17").toISODate());
    expect(due.label).toBe("Oct 17, 2026");
    expect(due.tooltip).toEqual(Some("Due Oct 17, 2026 · from “by Friday”"));
  });

  it("has no tooltip for a set date with no phrase", () => {
    const due = suggestionDue(suggestion(Some(noon("2026-10-17")), None), "en-US");
    expect(due.spoken).toBe(true);
    expect(due.tooltip).toEqual(None);
  });

  it("falls back to the next session", () => {
    const due = suggestionDue(suggestion(None, None, DueSource.NextSession), "en-US");
    expect(due.spoken).toBe(false);
    expect(due.label).toBe("Oct 18, 2026");
    expect(due.tooltip).toEqual(Some("No date mentioned. Defaults to your next session"));
  });

  it("falls back to a week from today", () => {
    const due = suggestionDue(suggestion(None, None, DueSource.SevenDays), "en-US");
    expect(due.spoken).toBe(false);
    expect(due.tooltip).toEqual(Some("No date mentioned. Defaults to a week from today"));
  });

  it("quotes a phrase that did not resolve to a date", () => {
    const due = suggestionDue(suggestion(None, Some("soon"), DueSource.SevenDays), "en-US");
    expect(due.spoken).toBe(false);
    expect(due.tooltip).toEqual(
      Some("Heard “soon”, but no date was set. Defaults to a week from today")
    );
  });
});
