import { describe, it, expect } from "vitest";
import {
  otherMoveFailedMessage,
  sessionRemovedMessage,
} from "@/components/ui/dashboard/session-change-message";
import { SessionRemoval } from "@/lib/session-actions";
import { createMockRelationship } from "../../../test-utils";

const relationships = [
  createMockRelationship({ id: "rel-1", coachee_first_name: "James", coachee_last_name: "Hodapp" }),
];
// 03:00 UTC on Nov 5 is 9 PM on Nov 4 in Chicago (after DST ends).
const session = { date: "2026-11-05T03:00:00", coaching_relationship_id: "rel-1" };
const halfPast = { ...session, date: "2026-11-05T03:30:00" };

describe("session change messages", () => {
  it("says what was removed, and when", () => {
    expect(sessionRemovedMessage(session, relationships, "America/Chicago", SessionRemoval.Remove)).toBe(
      "Removed the Nov 4 @ 9 PM session with James Hodapp"
    );
  });

  it("keeps the minutes when the session isn't on the hour", () => {
    expect(sessionRemovedMessage(halfPast, relationships, "America/Chicago", SessionRemoval.Remove)).toBe(
      "Removed the Nov 4 @ 9:30 PM session with James Hodapp"
    );
  });

  it("says Cancelled for an upcoming session", () => {
    expect(sessionRemovedMessage(session, relationships, "America/Chicago", SessionRemoval.Cancel)).toBe(
      "Cancelled the Nov 4 @ 9 PM session with James Hodapp"
    );
  });

  it("leaves the name out when the relationship isn't loaded", () => {
    expect(sessionRemovedMessage(session, [], "UTC", SessionRemoval.Remove)).toBe("Removed the Nov 5 @ 3 AM session");
  });
});

describe("otherMoveFailedMessage", () => {
  it("names the person whose session stayed put", () => {
    expect(otherMoveFailedMessage("Ehab Badawi")).toBe(
      "Couldn't move Ehab's session · Reschedule it from the dashboard"
    );
  });
});
