import { describe, it, expect } from "vitest";
import {
  seriesCreatedMessage,
  sessionCreatedMessage,
  sessionRemovedMessage,
  sessionUpdatedMessage,
} from "@/components/ui/dashboard/session-change-message";
import { createMockRelationship } from "../../../test-utils";

const relationships = [
  createMockRelationship({ id: "rel-1", coachee_first_name: "James", coachee_last_name: "Hodapp" }),
];
// 03:00 UTC on Nov 5 is 9 PM on Nov 4 in Chicago (after DST ends).
const session = { date: "2026-11-05T03:00:00", coaching_relationship_id: "rel-1" };
const halfPast = { ...session, date: "2026-11-05T03:30:00" };

describe("session change messages", () => {
  it("says what was created, with whom and when, locally", () => {
    expect(sessionCreatedMessage(session, relationships, "America/Chicago")).toBe(
      "Created the Nov 4 @ 9 PM session with James Hodapp"
    );
  });

  it("says what was updated or removed, and when", () => {
    expect(sessionUpdatedMessage(session, relationships, "America/Chicago")).toBe(
      "Updated the Nov 4 @ 9 PM session with James Hodapp"
    );
    expect(sessionRemovedMessage(session, relationships, "America/Chicago")).toBe(
      "Removed the Nov 4 @ 9 PM session with James Hodapp"
    );
  });

  it("keeps the minutes when the session isn't on the hour", () => {
    expect(sessionRemovedMessage(halfPast, relationships, "America/Chicago")).toBe(
      "Removed the Nov 4 @ 9:30 PM session with James Hodapp"
    );
  });

  it("leaves the name out when the relationship isn't loaded", () => {
    expect(sessionCreatedMessage(session, [], "UTC")).toBe("Created the Nov 5 @ 3 AM session");
    expect(sessionRemovedMessage(session, [], "UTC")).toBe("Removed the Nov 5 @ 3 AM session");
  });
});

describe("seriesCreatedMessage", () => {
  it("counts the sessions and names the coachee", () => {
    expect(seriesCreatedMessage(3, "rel-1", relationships)).toBe("Created 3 recurring sessions with James Hodapp");
    expect(seriesCreatedMessage(1, "rel-1", relationships)).toBe("Created 1 recurring session with James Hodapp");
  });
});
