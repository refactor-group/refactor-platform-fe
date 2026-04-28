import { describe, it, expect } from "vitest";
import {
  getRelationshipParticipantInfo,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import { RelationshipRole } from "@/types/relationship-role";
import { createMockRelationship } from "../test-utils";

describe("sortRelationshipsByParticipantName", () => {
  const coachId = "user-coach";

  it("sorts by coachee full name when the user is the coach", () => {
    const unsorted = [
      createMockRelationship({
        id: "r-1",
        coach_id: coachId,
        coachee_first_name: "Zoe",
        coachee_last_name: "Zimmerman",
      }),
      createMockRelationship({
        id: "r-2",
        coach_id: coachId,
        coachee_first_name: "Alice",
        coachee_last_name: "Anderson",
      }),
      createMockRelationship({
        id: "r-3",
        coach_id: coachId,
        coachee_first_name: "Mike",
        coachee_last_name: "Miller",
      }),
    ];

    const sorted = sortRelationshipsByParticipantName(unsorted, coachId);

    expect(sorted.map((r) => r.id)).toEqual(["r-2", "r-3", "r-1"]);
  });

  it("sorts by coach full name when the user is the coachee", () => {
    const coacheeId = "user-coachee";
    const unsorted = [
      createMockRelationship({
        id: "r-1",
        coachee_id: coacheeId,
        coach_id: "other-1",
        coach_first_name: "Zach",
        coach_last_name: "Zeller",
      }),
      createMockRelationship({
        id: "r-2",
        coachee_id: coacheeId,
        coach_id: "other-2",
        coach_first_name: "Beth",
        coach_last_name: "Brown",
      }),
    ];

    const sorted = sortRelationshipsByParticipantName(unsorted, coacheeId);

    expect(sorted.map((r) => r.id)).toEqual(["r-2", "r-1"]);
  });

  it("is case-insensitive via localeCompare", () => {
    const unsorted = [
      createMockRelationship({
        id: "r-lower",
        coach_id: coachId,
        coachee_first_name: "bob",
        coachee_last_name: "brown",
      }),
      createMockRelationship({
        id: "r-upper",
        coach_id: coachId,
        coachee_first_name: "Alice",
        coachee_last_name: "Anderson",
      }),
    ];

    const sorted = sortRelationshipsByParticipantName(unsorted, coachId);

    expect(sorted.map((r) => r.id)).toEqual(["r-upper", "r-lower"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      createMockRelationship({
        id: "r-1",
        coach_id: coachId,
        coachee_first_name: "Zoe",
      }),
      createMockRelationship({
        id: "r-2",
        coach_id: coachId,
        coachee_first_name: "Alice",
      }),
    ];
    const originalOrder = input.map((r) => r.id);

    sortRelationshipsByParticipantName(input, coachId);

    expect(input.map((r) => r.id)).toEqual(originalOrder);
  });

  it("returns an empty array when given an empty array", () => {
    expect(sortRelationshipsByParticipantName([], coachId)).toEqual([]);
  });
});

describe("getRelationshipParticipantInfo", () => {
  it("returns coachee details when the viewer is the coach", () => {
    const relationship = createMockRelationship({
      coach_id: "user-coach",
      coachee_id: "user-coachee",
      coach_first_name: "Casey",
      coach_last_name: "Coach",
      coachee_first_name: "Alex",
      coachee_last_name: "Chen",
    });

    expect(getRelationshipParticipantInfo(relationship, "user-coach")).toEqual({
      participantName: "Alex Chen",
      firstName: "Alex",
      lastName: "Chen",
      userRole: RelationshipRole.Coach,
      isCoach: true,
    });
  });

  it("returns coach details when the viewer is the coachee", () => {
    const relationship = createMockRelationship({
      coach_id: "user-coach",
      coachee_id: "user-coachee",
      coach_first_name: "Casey",
      coach_last_name: "Coach",
      coachee_first_name: "Alex",
      coachee_last_name: "Chen",
    });

    expect(
      getRelationshipParticipantInfo(relationship, "user-coachee")
    ).toEqual({
      participantName: "Casey Coach",
      firstName: "Casey",
      lastName: "Coach",
      userRole: RelationshipRole.Coachee,
      isCoach: false,
    });
  });

  it("falls back to coachee role when the viewer matches neither coach nor coachee", () => {
    // Defensive default: caller should never pass a non-participant viewer,
    // but if they do we still produce a valid (coach-pointing) info object.
    const relationship = createMockRelationship({
      coach_id: "user-coach",
      coachee_id: "user-coachee",
      coach_first_name: "Casey",
      coach_last_name: "Coach",
    });

    const info = getRelationshipParticipantInfo(relationship, "stranger");
    expect(info.isCoach).toBe(false);
    expect(info.userRole).toBe(RelationshipRole.Coachee);
    expect(info.participantName).toBe("Casey Coach"); // viewer treated as coachee → sees coach
  });

  it("trims whitespace when only one name field is populated", () => {
    const relationship = createMockRelationship({
      coach_id: "user-coach",
      coachee_id: "user-coachee",
      coachee_first_name: "Alex",
      coachee_last_name: "",
    });

    const info = getRelationshipParticipantInfo(relationship, "user-coach");
    expect(info.participantName).toBe("Alex");
    expect(info.firstName).toBe("Alex");
    expect(info.lastName).toBe("");
  });
});
