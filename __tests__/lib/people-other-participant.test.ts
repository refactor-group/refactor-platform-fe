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
    coach_email: "jan@example.com",
    coachee_email: "maryann@example.com",
  });

  it("builds the other person from their first and last names", () => {
    expect(otherParticipant(rel, "coachee")).toEqual({
      userId: "coach",
      firstName: "Jan",
      fullName: "Jan Van Dyke",
      initials: "JV",
      email: "jan@example.com",
    });
    expect(otherParticipant(rel, "coach")).toMatchObject({
      userId: "coachee",
      fullName: "Mary Ann Lee",
      initials: "ML",
      email: "maryann@example.com",
    });
  });
});
