import { describe, it, expect } from "vitest";
import { parseCoachingRelationship, sortRelationshipsByParticipantName } from "@/types/coaching-relationship";
import { createMockRelationship } from "../test-utils";

describe("sortRelationshipsByParticipantName", () => {
  const coachId = "user-coach";

  it("sorts by coachee full name when the user is the coach", () => {
    const unsorted = [
      createMockRelationship({ id: "r-1", coach_id: coachId }, { coachee: { first_name: "Zoe", last_name: "Zimmerman" } }),
      createMockRelationship({ id: "r-2", coach_id: coachId }, { coachee: { first_name: "Alice", last_name: "Anderson" } }),
      createMockRelationship({ id: "r-3", coach_id: coachId }, { coachee: { first_name: "Mike", last_name: "Miller" } }),
    ];

    const sorted = sortRelationshipsByParticipantName(unsorted, coachId);

    expect(sorted.map((r) => r.id)).toEqual(["r-2", "r-3", "r-1"]);
  });

  it("sorts by coach full name when the user is the coachee", () => {
    const coacheeId = "user-coachee";
    const unsorted = [
      createMockRelationship({ id: "r-1", coachee_id: coacheeId, coach_id: "other-1" }, { coach: { first_name: "Zach", last_name: "Zeller" } }),
      createMockRelationship({ id: "r-2", coachee_id: coacheeId, coach_id: "other-2" }, { coach: { first_name: "Beth", last_name: "Brown" } }),
    ];

    const sorted = sortRelationshipsByParticipantName(unsorted, coacheeId);

    expect(sorted.map((r) => r.id)).toEqual(["r-2", "r-1"]);
  });

  it("is case-insensitive via localeCompare", () => {
    const unsorted = [
      createMockRelationship({ id: "r-lower", coach_id: coachId }, { coachee: { first_name: "bob", last_name: "brown" } }),
      createMockRelationship({ id: "r-upper", coach_id: coachId }, { coachee: { first_name: "Alice", last_name: "Anderson" } }),
    ];

    const sorted = sortRelationshipsByParticipantName(unsorted, coachId);

    expect(sorted.map((r) => r.id)).toEqual(["r-upper", "r-lower"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      createMockRelationship({ id: "r-1", coach_id: coachId }, { coachee: { first_name: "Zoe" } }),
      createMockRelationship({ id: "r-2", coach_id: coachId }, { coachee: { first_name: "Alice" } }),
    ];
    const originalOrder = input.map((r) => r.id);

    sortRelationshipsByParticipantName(input, coachId);

    expect(input.map((r) => r.id)).toEqual(originalOrder);
  });

  it("returns an empty array when given an empty array", () => {
    expect(sortRelationshipsByParticipantName([], coachId)).toEqual([]);
  });
});

describe("parseCoachingRelationship", () => {
  const wire = () => JSON.parse(JSON.stringify(createMockRelationship({ coach_id: "c", coachee_id: "e" })));

  it("accepts a relationship with both seats among its participants", () => {
    const raw = wire();
    expect(parseCoachingRelationship(raw)).toBe(raw);
  });

  it("rejects the old shape, with names and no participants", () => {
    const { participants: _participants, ...rest } = wire();
    const old = { ...rest, coach_first_name: "Jim", coach_last_name: "Hodapp", coachee_first_name: "Caleb", coachee_last_name: "Bourg" };
    expect(() => parseCoachingRelationship(old)).toThrow();
  });

  it("rejects participants that don't hold both seats", () => {
    const raw = wire();
    raw.participants[1].id = "someone-else";
    expect(() => parseCoachingRelationship(raw)).toThrow();
  });
});
