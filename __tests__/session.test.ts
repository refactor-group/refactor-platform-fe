import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
  selectNextUpcomingSession,
  getSessionParticipantInfo,
  formatSessionTime,
  IMMINENT_SESSION_THRESHOLD_MINUTES,
  SOON_SESSION_THRESHOLD_MINUTES,
} from "@/lib/utils/session";
import { SessionUrgency } from "@/types/session-display";
import { RelationshipRole } from "@/types/relationship-role";
import { None } from "@/types/option";
import {
  createMockSession,
  createSessionAt,
  COACHEE_VIEWER,
  COLLEAGUE_VIEWER,
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

  // The "today / tomorrow / yesterday" branches of getUrgencyMessage compare
  // calendar days using DateTime.now(), so they're sensitive to where the
  // wall clock sits relative to midnight. Pin "now" to noon UTC for the
  // remainder of this describe block so the day-prefix assertions are stable
  // regardless of when CI happens to run.
  describe("day-relative prefixes", () => {
    const originalNow = Settings.now;
    const fakeNow = DateTime.fromISO("2026-03-26T12:00:00.000Z", { zone: "utc" });

    beforeEach(() => {
      Settings.now = () => fakeNow.toMillis();
    });

    afterEach(() => {
      Settings.now = originalNow;
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
      // Session at 6 PM UTC; "now" is pinned at noon UTC, so the session is
      // safely later today (> 2 hour threshold) → Later urgency.
      const todayAt6PM = fakeNow.set({ hour: 18 });

      const session = createMockSession({
        date: todayAt6PM.toUTC().toISO(),
      });

      const urgency = calculateSessionUrgency(session);
      const message = getUrgencyMessage(session, urgency);

      expect(urgency).toBe(SessionUrgency.Later);
      expect(message).toContain("Scheduled for this");
    });
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
    expect(info?.canSchedule).toBe(true);
    expect(info?.userRole).toBe(RelationshipRole.Coach);
    expect(info?.participantName).toBe("Alex Chen");
    expect(info?.firstName).toBe("Alex");
    expect(info?.lastName).toBe("Chen");
  });

  it("returns coachee-role info when the viewer is the coachee", () => {
    const base = createMockEnrichedSession();
    const session = createMockEnrichedSession({ relationship: { ...base.relationship!, viewer: COACHEE_VIEWER } });
    const info = getSessionParticipantInfo(session, "coachee-1");
    expect(info).not.toBeNull();
    expect(info?.canSchedule).toBe(false);
    expect(info?.userRole).toBe(RelationshipRole.Coachee);
    expect(info?.participantName).toBe("Jim Hodapp");
    expect(info?.firstName).toBe("Jim");
    expect(info?.lastName).toBe("Hodapp");
  });

  it("lets either colleague schedule, as the backend says", () => {
    const base = createMockEnrichedSession();
    const session = createMockEnrichedSession({ relationship: { ...base.relationship!, viewer: COLLEAGUE_VIEWER } });
    const info = getSessionParticipantInfo(session, "coachee-1");
    expect(info?.canSchedule).toBe(true);
    expect(info?.userRole).toBe(RelationshipRole.Colleague);
    expect(info?.participantName).toBe("Jim Hodapp");
  });

  it("returns null for a viewer who isn't in the relationship", () => {
    const base = createMockEnrichedSession();
    const session = createMockEnrichedSession({ relationship: { ...base.relationship!, viewer: null } });
    expect(getSessionParticipantInfo(session, "admin-1")).toBeNull();
  });

  it("returns null when the session has no relationship", () => {
    const session = createMockEnrichedSession({ relationship: undefined });
    expect(getSessionParticipantInfo(session, "coach-1")).toBeNull();
  });

  it("returns a 'data not loaded' fallback when the participants are missing", () => {
    const session = createMockEnrichedSession({ participants: None });
    const info = getSessionParticipantInfo(session, "coach-1");
    expect(info).not.toBeNull();
    expect(info?.canSchedule).toBe(true);
    expect(info?.participantName).toBe("(data not loaded)");
    expect(info?.firstName).toBe("");
    expect(info?.lastName).toBe("");
    expect(info?.isMissing).toBe(true);
  });
});

describe("formatSessionTime", () => {
  it("formats a naive UTC date in the given timezone", () => {
    expect(formatSessionTime("2026-08-25T19:30:00", "America/Chicago")).toBe("2:30 PM CDT");
  });

  it("follows the timezone's offset across DST", () => {
    expect(formatSessionTime("2026-12-01T19:30:00", "America/Chicago")).toBe("1:30 PM CST");
  });
});
