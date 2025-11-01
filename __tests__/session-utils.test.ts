import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
  enrichSessionForDisplay,
} from "@/lib/sessions/session-utils";
import {
  getOtherParticipantName,
  getUserRoleInRelationship,
} from "@/lib/relationships/relationship-utils";
import { SessionUrgency } from "@/types/session-display";
import {
  createMockUser,
  createMockRelationship,
  createMockSession,
  createSessionAt,
} from "./test-utils";

/**
 * Test Suite: Session Utility Functions
 * Story: "Transform raw session data into display-ready information"
 */

describe("calculateSessionUrgency", () => {
  it("identifies past sessions (session ended more than 0 minutes ago)", () => {
    const session = createSessionAt(-30); // 30 minutes ago
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Past);
  });

  it("identifies imminent sessions (starting within 30 minutes)", () => {
    const session = createSessionAt(15); // 15 minutes from now
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Imminent);
  });

  it("identifies soon sessions (starting within 2 hours)", () => {
    const session = createSessionAt(90); // 90 minutes from now
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Soon);
  });

  it("identifies later sessions (more than 2 hours away)", () => {
    const session = createSessionAt(180); // 3 hours from now
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Later);
  });

  it("treats session starting exactly now as imminent", () => {
    const session = createSessionAt(0); // right now
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Imminent);
  });

  it("treats session starting in exactly 30 minutes as imminent", () => {
    const session = createSessionAt(30); // boundary case
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Imminent);
  });

  it("treats session starting in exactly 120 minutes as soon", () => {
    const session = createSessionAt(120); // boundary case
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Soon);
  });
});

describe("getUrgencyMessage", () => {
  it("returns past message for past sessions", () => {
    const session = createSessionAt(-30);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toContain("Ended");
  });

  it("returns imminent message with exact minutes for sessions < 30 min", () => {
    const session = createSessionAt(15);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toContain("Starting in 15 minutes");
  });

  it("returns 'Starting now!' for sessions starting right now", () => {
    const session = createSessionAt(0);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toBe("Starting now!");
  });

  it("returns soon message with hours for sessions < 2 hours", () => {
    const session = createSessionAt(90);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toContain("Next session in");
    expect(message).toContain("hour");
  });

  it("returns later message for sessions > 2 hours away", () => {
    const session = createSessionAt(180);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toContain("Scheduled for");
  });

  it("formats time correctly in later message", () => {
    const session = createSessionAt(180);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);

    // Should contain formatted time like "this afternoon" or specific time
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain("Scheduled for");
  });
});

describe("getOtherParticipantName", () => {
  it("returns coachee name when user is the coach", () => {
    const user = createMockUser({ id: "coach-1" });
    const relationship = createMockRelationship({
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      coachee_first_name: "Alice",
      coachee_last_name: "Smith",
    });

    const name = getOtherParticipantName(relationship, user);
    expect(name).toBe("Alice Smith");
  });

  it("returns coach name when user is the coachee", () => {
    const user = createMockUser({ id: "coachee-1" });
    const relationship = createMockRelationship({
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      coach_first_name: "Bob",
      coach_last_name: "Johnson",
    });

    const name = getOtherParticipantName(relationship, user);
    expect(name).toBe("Bob Johnson");
  });

  it("handles missing last name gracefully", () => {
    const user = createMockUser({ id: "coach-1" });
    const relationship = createMockRelationship({
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      coachee_first_name: "Alice",
      coachee_last_name: "",
    });

    const name = getOtherParticipantName(relationship, user);
    expect(name).toBe("Alice");
  });
});

describe("getUserRoleInRelationship", () => {
  it("returns 'Coach' when user is the coach", () => {
    const user = createMockUser({ id: "coach-1" });
    const relationship = createMockRelationship({
      coach_id: "coach-1",
      coachee_id: "coachee-1",
    });

    const role = getUserRoleInRelationship(relationship, user);
    expect(role).toBe("Coach");
  });

  it("returns 'Coachee' when user is the coachee", () => {
    const user = createMockUser({ id: "coachee-1" });
    const relationship = createMockRelationship({
      coach_id: "coach-1",
      coachee_id: "coachee-1",
    });

    const role = getUserRoleInRelationship(relationship, user);
    expect(role).toBe("Coachee");
  });
});

describe("enrichSessionForDisplay", () => {
  it("enriches session with all display properties", () => {
    const user = createMockUser({ id: "coach-1", timezone: "America/Los_Angeles" });
    const relationship = createMockRelationship({
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      coachee_first_name: "Alice",
      coachee_last_name: "Smith",
    });
    const session = createSessionAt(90);
    const goal = { id: "goal-1", title: "Q4 Strategy Review" };
    const organization = { id: "org-1", name: "Acme Corp" };

    const enriched = enrichSessionForDisplay(
      session,
      relationship,
      user,
      goal,
      organization
    );

    expect(enriched.id).toBe(session.id);
    expect(enriched.goalTitle).toBe("Q4 Strategy Review");
    expect(enriched.participantName).toBe("Alice Smith");
    expect(enriched.userRole).toBe("Coach");
    expect(enriched.organizationName).toBe("Acme Corp");
    expect(enriched.dateTime).toContain("at"); // e.g., "Today at 10:00 AM PST"
    expect(enriched.isPast).toBe(false);
    expect(enriched.urgency.type).toBe(SessionUrgency.Soon);
    expect(enriched.urgency.message).toContain("Next session in");
  });

  it("handles past sessions correctly", () => {
    const user = createMockUser({ id: "coach-1" });
    const relationship = createMockRelationship({ coach_id: "coach-1" });
    const session = createSessionAt(-30); // 30 minutes ago
    const goal = { id: "goal-1", title: "Past Session" };
    const organization = { id: "org-1", name: "Acme Corp" };

    const enriched = enrichSessionForDisplay(
      session,
      relationship,
      user,
      goal,
      organization
    );

    expect(enriched.isPast).toBe(true);
    expect(enriched.urgency.type).toBe(SessionUrgency.Past);
  });

  it("handles missing goal title gracefully", () => {
    const user = createMockUser({ id: "coach-1" });
    const relationship = createMockRelationship({ coach_id: "coach-1" });
    const session = createSessionAt(90);
    const goal = null;
    const organization = { id: "org-1", name: "Acme Corp" };

    const enriched = enrichSessionForDisplay(
      session,
      relationship,
      user,
      goal,
      organization
    );

    expect(enriched.goalTitle).toBe("Coaching Session");
  });

  it("formats dateTime in user's timezone", () => {
    const user = createMockUser({
      id: "coach-1",
      timezone: "America/New_York",
    });
    const relationship = createMockRelationship({ coach_id: "coach-1" });
    const session = createMockSession({
      date: DateTime.fromISO("2025-10-23T14:00:00", {
        zone: "America/Los_Angeles",
      }).toISO(),
    });
    const goal = { id: "goal-1", title: "Test" };
    const organization = { id: "org-1", name: "Acme Corp" };

    const enriched = enrichSessionForDisplay(
      session,
      relationship,
      user,
      goal,
      organization
    );

    // Should convert to user's timezone (EST is +3 hours from PST)
    expect(enriched.dateTime).toContain("5:00 PM"); // 2PM PST = 5PM EST
  });
});
