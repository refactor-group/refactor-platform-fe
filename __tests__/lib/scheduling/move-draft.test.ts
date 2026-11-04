import { describe, expect, it } from "vitest";
import { moveChanged, moveHint, movePerson, moveRail } from "@/lib/move-draft";
import { initialDraft } from "@/lib/new-session-dialog-model";
import { peopleFor } from "@/lib/people";
import { type BusySession, StepKind } from "@/lib/scheduling";
import { None, Some } from "@/types/option";
import { E_18, ME, P_18, RELATIONSHIPS, ZONE, at, session } from "./roster";

const EHAB = { id: "ehab", first: "Ehab", last: "Badawi" };
const priya: BusySession = { id: "p-18", personName: "Priya Raman", start: at("2026-08-18T16:30"), end: at("2026-08-18T17:20") };
const sameSlot = { start: Some(at("2026-08-18T14:30")), minutes: 50 };

describe("movePerson", () => {
  it("finds the person by the session's relationship", () => {
    const entry = movePerson(E_18, ME, peopleFor(ME, RELATIONSHIPS));
    expect(entry.some && entry.val.person.fullName).toBe("Ehab Badawi");
    expect(entry.some && entry.val.relationshipIds).toEqual(["rel-e"]);
  });

  it("falls back to the session's other participant", () => {
    const entry = movePerson(P_18, ME, []);
    expect(entry.some && entry.val.person).toEqual({
      userId: "priya",
      firstName: "Priya",
      fullName: "Priya Raman",
      initials: "PR",
    });
  });

  it("uses the coach when I'm the coachee", () => {
    const mine = session({
      id: "b-1",
      relationshipId: "rel-b",
      person: { id: "boss", first: "Boss", last: "Person" },
      start: "2026-08-19T10:00",
      asCoachee: true,
    });
    const entry = movePerson(mine, ME, []);
    expect(entry.some && entry.val.person.userId).toBe("boss");
  });

  it("has no one without participants", () => {
    expect(movePerson({ ...E_18, coach: undefined, coachee: undefined }, ME, [])).toEqual(None);
  });
});

describe("moveChanged", () => {
  it("is unchanged at the session's own slot", () => {
    expect(moveChanged(E_18, sameSlot, ZONE)).toBe(false);
  });

  it("changes with a new start or duration", () => {
    expect(moveChanged(E_18, { ...sameSlot, start: Some(at("2026-08-20T14:30")) }, ZONE)).toBe(true);
    expect(moveChanged(E_18, { ...sameSlot, minutes: 55 }, ZONE)).toBe(true);
  });
});

describe("moveHint", () => {
  it("asks for a change first, then for the overlap", () => {
    const unresolved = { kind: "unresolved" } as const;
    expect(moveHint({ availability: { kind: "loaded" }, changed: false, clash: None, resolution: unresolved })).toEqual(Some("Pick a new date or time."));
    expect(moveHint({ availability: { kind: "loaded" }, changed: true, clash: Some(priya), resolution: unresolved })).toEqual(
      Some("Pick a new time for Priya, or keep both.")
    );
    expect(moveHint({ availability: { kind: "loaded" }, changed: true, clash: Some(priya), resolution: { kind: "keep" } })).toEqual(None);
    expect(moveHint({ availability: { kind: "loaded" }, changed: true, clash: None, resolution: unresolved })).toEqual(None);
  });
});

describe("moveRail", () => {
  const input = {
    order: [StepKind.When, StepKind.Resolve],
    step: StepKind.When,
    start: Some(at("2026-08-18T16:30")),
    changed: true,
    clash: Some(priya),
    resolution: { kind: "unresolved" } as const,
  };

  it("shows When and Resolve overlap, with no Who", () => {
    expect(moveRail(input)).toEqual([
      { id: StepKind.When, label: "When", value: "Tuesday, August 18, 4:30 PM", done: true, current: true },
      { id: StepKind.Resolve, label: "Resolve overlap", value: "Choose a new time for Priya", done: false, current: false },
    ]);
  });

  it("checks When only once it changes", () => {
    const [when] = moveRail({ ...input, order: [StepKind.When], changed: false });
    expect(when.done).toBe(false);
  });
});

describe("initialDraft: move", () => {
  it("starts on the session's day, time, duration and month", () => {
    const later = session({ id: "e-x", relationshipId: "rel-e", person: EHAB, start: "2026-10-06T09:15", minutes: 90 });
    const draft = initialDraft({ kind: "move", session: later }, ZONE);
    expect(draft.day.some && draft.day.val.toISODate()).toBe("2026-10-06");
    expect(draft.month.some && draft.month.val.toISODate()).toBe("2026-10-01");
    expect(draft.time).toEqual(Some("09:15"));
    expect(draft.minutes).toEqual(Some(90));
    expect(draft.whenTouched).toBe(true);
    expect(draft.step).toBe(StepKind.When);
  });
});
