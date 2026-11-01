import { describe, it, expect } from "vitest";
import {
  seriesCreatedMessage,
  sessionChangeMessage,
} from "@/components/ui/dashboard/session-change-message";
import { createMockRelationship } from "../../../test-utils";

const relationships = [
  createMockRelationship({ id: "rel-1", coachee_first_name: "James", coachee_last_name: "Hodapp" }),
];
const session = { date: "2026-11-05T03:00:00", coaching_relationship_id: "rel-1" };

describe("sessionChangeMessage", () => {
  it.each(["Created", "Updated", "Deleted"] as const)("says what was %s, with whom and when, locally", (change) => {
    expect(sessionChangeMessage(change, session, relationships, "America/Chicago")).toBe(
      `${change} Nov 4 session with James Hodapp at 9:00 PM`
    );
  });

  it("leaves the name out when the relationship isn't loaded", () => {
    expect(sessionChangeMessage("Created", session, [], "UTC")).toBe("Created Nov 5 session at 3:00 AM");
  });
});

describe("seriesCreatedMessage", () => {
  it("counts the sessions and names the coachee", () => {
    expect(seriesCreatedMessage(3, "rel-1", relationships)).toBe("Created 3 recurring sessions with James Hodapp");
    expect(seriesCreatedMessage(1, "rel-1", relationships)).toBe("Created 1 recurring session with James Hodapp");
  });
});
