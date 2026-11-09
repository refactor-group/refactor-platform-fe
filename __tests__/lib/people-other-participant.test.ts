import { describe, expect, it } from "vitest";
import { otherParticipant } from "@/lib/people";
import { createMockRelationship } from "../test-utils";

describe("otherParticipant", () => {
  const rel = createMockRelationship({
    coach_id: "coach",
    coach_first_name: "Jan",
    coach_last_name: "Van Dyke",
    coachee_id: "coachee",
    coachee_first_name: "Mary Ann",
    coachee_last_name: "Lee",
  });

  it("builds the other person from their first and last names", () => {
    expect(otherParticipant(rel, "coachee")).toEqual({
      userId: "coach",
      firstName: "Jan",
      fullName: "Jan Van Dyke",
      initials: "JV",
    });
    expect(otherParticipant(rel, "coach")).toMatchObject({ userId: "coachee", fullName: "Mary Ann Lee", initials: "ML" });
  });
});
