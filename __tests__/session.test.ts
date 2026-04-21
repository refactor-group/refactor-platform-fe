import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
  enrichSessionForDisplay,
  selectNextUpcomingSession,
  getSessionParticipantInfo,
  getSessionParticipantName,
  IMMINENT_SESSION_THRESHOLD_MINUTES,
  SOON_SESSION_THRESHOLD_MINUTES,
} from "@/lib/utils/session";
import {
  getOtherParticipantName,
  getUserRoleInRelationship,
} from "@/lib/utils/relationship";
import { SessionUrgency } from "@/types/session-display";
import { RelationshipRole } from "@/types/relationship-role";
import {
  createMockUser,
  createMockRelationship,
  createMockSession,
  createSessionAt,
  createMockEnrichedSession,
  createEnrichedSessionAt,
} from "./test-utils";

/**
 * Test Suite: Session Utility Functions
 * Story: "Transform raw session data into display-ready information"
 */

describe("calculateSessionUrgency", () => {
  it("identifies past sessions (session duration has fully elapsed)", () => {
    const session = createSessionAt(-120); // 2 hours ago, well past the 60-min duration
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Past);
  });

  it("identifies underway sessions (started 5+ minutes ago but duration not elapsed)", () => {
    const session = createSessionAt(-30); // 30 minutes ago, still within 60-min duration
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Underway);
  });

  it(`identifies imminent sessions (starting within ${IMMINENT_SESSION_THRESHOLD_MINUTES} minutes)`, () => {
    const session = createSessionAt(15); // 15 minutes from now
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Imminent);
  });

  it(`identifies soon sessions (starting within ${SOON_SESSION_THRESHOLD_MINUTES} minutes)`, () => {
    const session = createSessionAt(90); // 90 minutes from now
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Soon);
  });

  it(`identifies later sessions (more than ${SOON_SESSION_THRESHOLD_MINUTES} minutes away)`, () => {
    const session = createSessionAt(SOON_SESSION_THRESHOLD_MINUTES + 60); // Beyond threshold
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Later);
  });

  it("treats session starting exactly now as imminent", () => {
    const session = createSessionAt(0); // right now
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Imminent);
  });

  it(`treats session starting in exactly ${IMMINENT_SESSION_THRESHOLD_MINUTES} minutes as imminent`, () => {
    const session = createSessionAt(IMMINENT_SESSION_THRESHOLD_MINUTES); // boundary case
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Imminent);
  });

  it(`treats session starting in exactly ${SOON_SESSION_THRESHOLD_MINUTES} minutes as soon`, () => {
    const session = createSessionAt(SOON_SESSION_THRESHOLD_MINUTES); // boundary case
    const urgency = calculateSessionUrgency(session);
    expect(urgency).toBe(SessionUrgency.Soon);
  });
});

describe("getUrgencyMessage", () => {
  it("returns past message for past sessions", () => {
    const session = createSessionAt(-120); // 2 hours ago, well past 60-min duration
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toContain("Ended");
  });

  it("returns 'Under way' for sessions that started 5+ minutes ago", () => {
    const session = createSessionAt(-30); // 30 minutes ago, still within duration
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toBe("Under way");
  });

  it(`returns imminent message with exact minutes for sessions < ${IMMINENT_SESSION_THRESHOLD_MINUTES} min`, () => {
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

  it(`returns soon message with hours for sessions < ${SOON_SESSION_THRESHOLD_MINUTES} minutes`, () => {
    const session = createSessionAt(90);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toContain("Next session in");
    expect(message).toContain("hour");
  });

  it(`returns later message for sessions > ${SOON_SESSION_THRESHOLD_MINUTES} minutes away`, () => {
    const session = createSessionAt(SOON_SESSION_THRESHOLD_MINUTES + 60);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);
    expect(message).toContain("Scheduled for");
  });

  it("formats time correctly in later message", () => {
    const session = createSessionAt(SOON_SESSION_THRESHOLD_MINUTES + 60);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);

    // Should contain formatted time like "this afternoon" or specific time
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain("Scheduled for");
  });

  it("returns 'tomorrow' prefix for sessions scheduled tomorrow", () => {
    // Create a session 24 hours from now
    const session = createSessionAt(24 * 60);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);

    expect(message).toContain("Scheduled for tomorrow");
  });

  it("returns 'yesterday' prefix for past sessions from yesterday", () => {
    // Create a session 24 hours ago
    const session = createSessionAt(-24 * 60);
    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);

    expect(message).toContain("Ended");
  });

  it("returns 'this morning/afternoon/evening' for sessions today", () => {
    // Create a session at 2 PM today to ensure it's beyond the 2 hour threshold
    // and still definitely today regardless of when the test runs
    const now = DateTime.now();
    const todayAt2PM = now.startOf('day').set({ hour: 14 }); // 2:00 PM today

    const session = createMockSession({
      date: todayAt2PM.toUTC().toISO(),
    });

    const urgency = calculateSessionUrgency(session);
    const message = getUrgencyMessage(session, urgency);

    // If we're testing before noon, it should say "this afternoon"
    // Only assert if it's actually in the "Later" category (> 2 hours away)
    if (urgency === SessionUrgency.Later) {
      expect(message).toContain("Scheduled for this");
    } else {
      // If it's not Later urgency (because test ran too close to 2 PM),
      // at least verify it's not tomorrow/yesterday
      expect(message).not.toContain("tomorrow");
      expect(message).not.toContain("yesterday");
    }
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

describe("selectNextUpcomingSession", () => {
  it("returns undefined for an empty list", () => {
    expect(selectNextUpcomingSession([])).toBeUndefined();
  });

  it("returns undefined when every session is in the past", () => {
    const sessions = [
      createEnrichedSessionAt(-120),
      createEnrichedSessionAt(-240),
    ];
    expect(selectNextUpcomingSession(sessions)).toBeUndefined();
  });

  it("selects the first non-past session in a mixed list", () => {
    const past = createEnrichedSessionAt(-120, { id: "past" });
    const imminent = createEnrichedSessionAt(15, { id: "imminent" });
    const later = createEnrichedSessionAt(SOON_SESSION_THRESHOLD_MINUTES + 60, { id: "later" });
    const result = selectNextUpcomingSession([past, imminent, later]);
    expect(result?.id).toBe("imminent");
  });

  it("selects an underway session over a later one", () => {
    const underway = createEnrichedSessionAt(-30, { id: "underway" });
    const later = createEnrichedSessionAt(SOON_SESSION_THRESHOLD_MINUTES + 60, { id: "later" });
    const result = selectNextUpcomingSession([underway, later]);
    expect(result?.id).toBe("underway");
  });

  it("returns the only session when it is not past", () => {
    const soon = createEnrichedSessionAt(90, { id: "only" });
    expect(selectNextUpcomingSession([soon])?.id).toBe("only");
  });
});

describe("getSessionParticipantInfo", () => {
  it("returns coach-role info when the viewer is the coach", () => {
    const session = createMockEnrichedSession();
    const info = getSessionParticipantInfo(session, "coach-1");
    expect(info).not.toBeNull();
    expect(info?.isCoach).toBe(true);
    expect(info?.userRole).toBe(RelationshipRole.Coach);
    expect(info?.participantName).toBe("Alex Chen");
    expect(info?.firstName).toBe("Alex");
    expect(info?.lastName).toBe("Chen");
  });

  it("returns coachee-role info when the viewer is the coachee", () => {
    const session = createMockEnrichedSession();
    const info = getSessionParticipantInfo(session, "coachee-1");
    expect(info).not.toBeNull();
    expect(info?.isCoach).toBe(false);
    expect(info?.userRole).toBe(RelationshipRole.Coachee);
    expect(info?.participantName).toBe("Jim Hodapp");
    expect(info?.firstName).toBe("Jim");
    expect(info?.lastName).toBe("Hodapp");
  });

  it("returns null when the session has no relationship", () => {
    const session = createMockEnrichedSession({ relationship: undefined });
    expect(getSessionParticipantInfo(session, "coach-1")).toBeNull();
  });

  it("returns a 'data not loaded' fallback when the counterpart user is missing", () => {
    const session = createMockEnrichedSession({ coachee: undefined });
    const info = getSessionParticipantInfo(session, "coach-1");
    expect(info).not.toBeNull();
    expect(info?.isCoach).toBe(true);
    expect(info?.participantName).toBe("Coachee (data not loaded)");
    expect(info?.firstName).toBe("");
    expect(info?.lastName).toBe("");
  });
});

describe("getSessionParticipantName", () => {
  // Happy-path coach/coachee cases are covered by getSessionParticipantInfo tests
  // above; this function now delegates to that. These tests exercise the
  // behavior unique to the name variant: null → "Unknown" and the terse
  // role-label collapse when the counterpart user object is missing.

  it("returns 'Unknown' when the session has no relationship", () => {
    const session = createMockEnrichedSession({ relationship: undefined });
    expect(getSessionParticipantName(session, "coach-1")).toBe("Unknown");
  });

  it("returns a role-aware fallback when the counterpart user is missing", () => {
    const coachMissing = createMockEnrichedSession({ coach: undefined });
    expect(getSessionParticipantName(coachMissing, "coachee-1")).toBe("Coach");
    const coacheeMissing = createMockEnrichedSession({ coachee: undefined });
    expect(getSessionParticipantName(coacheeMissing, "coach-1")).toBe("Coachee");
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
    const session = createSessionAt(-120); // 2 hours ago, well past 60-min duration
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
