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
      "Created Nov 4 session with James Hodapp at 9:00 PM"
    );
  });

  it("leads with the time and date for updates and removals", () => {
    expect(sessionUpdatedMessage(session, relationships, "America/Chicago")).toBe(
      "Updated the 9 PM Nov 4 session with James Hodapp"
    );
    expect(sessionRemovedMessage(session, relationships, "America/Chicago")).toBe(
      "Removed the 9 PM Nov 4 session with James Hodapp"
    );
  });

  it("keeps the minutes when the session isn't on the hour", () => {
    expect(sessionRemovedMessage(halfPast, relationships, "America/Chicago")).toBe(
      "Removed the 9:30 PM Nov 4 session with James Hodapp"
    );
  });

  it("leaves the name out when the relationship isn't loaded", () => {
    expect(sessionCreatedMessage(session, [], "UTC")).toBe("Created Nov 5 session at 3:00 AM");
    expect(sessionRemovedMessage(session, [], "UTC")).toBe("Removed the 3 AM Nov 5 session");
  });
});

describe("seriesCreatedMessage", () => {
  it("counts the sessions and names the coachee", () => {
    expect(seriesCreatedMessage(3, "rel-1", relationships)).toBe("Created 3 recurring sessions with James Hodapp");
    expect(seriesCreatedMessage(1, "rel-1", relationships)).toBe("Created 1 recurring session with James Hodapp");
  });
});
