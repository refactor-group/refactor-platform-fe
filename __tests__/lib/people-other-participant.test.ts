import { describe, expect, it } from "vitest";
import { otherParticipant } from "@/lib/people";
import { createMockRelationship } from "../test-utils";

describe("otherParticipant", () => {
  const rel = createMockRelationship(
    { coach_id: "coach", coachee_id: "coachee" },
    {
      coach: { first_name: "Jan", last_name: "Van Dyke", email: "jan@example.com" },
      coachee: { first_name: "Mary Ann", last_name: "Lee", email: "maryann@example.com" },
    }
  );

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
