import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import {
  calculateSessionUrgency,
  selectNextUpcomingSession,
  getSessionParticipantInfo,
  IMMINENT_SESSION_THRESHOLD_MINUTES,
  SOON_SESSION_THRESHOLD_MINUTES,
} from "@/lib/utils/session";
import { SessionUrgency } from "@/types/session-display";
import { RelationshipRole } from "@/types/relationship-role";
import { None } from "@/types/option";
import {
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

describe("selectNextUpcomingSession", () => {
  const originalNow = Settings.now;
  const NOW = DateTime.fromISO("2026-11-19T18:00:00.000Z", { zone: "utc" });

  beforeEach(() => {
    Settings.now = () => NOW.toMillis();
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it("returns undefined for an empty list", () => {
    expect(selectNextUpcomingSession([], NOW)).toBeUndefined();
  });

  it("returns undefined when every session is in the past", () => {
    const sessions = [
      createEnrichedSessionAt(-120),
      createEnrichedSessionAt(-240),
    ];
    expect(selectNextUpcomingSession(sessions, NOW)).toBeUndefined();
  });

  it("selects the first non-past session in a mixed list", () => {
    const past = createEnrichedSessionAt(-120, { id: "past" });
    const imminent = createEnrichedSessionAt(15, { id: "imminent" });
    const later = createEnrichedSessionAt(SOON_SESSION_THRESHOLD_MINUTES + 60, { id: "later" });
    const result = selectNextUpcomingSession([past, imminent, later], NOW);
    expect(result?.id).toBe("imminent");
  });

  it("selects an underway session over a later one", () => {
    const underway = createEnrichedSessionAt(-30, { id: "underway" });
    const later = createEnrichedSessionAt(SOON_SESSION_THRESHOLD_MINUTES + 60, { id: "later" });
    const result = selectNextUpcomingSession([underway, later], NOW);
    expect(result?.id).toBe("underway");
  });

  it("returns the only session when it is not past", () => {
    const soon = createEnrichedSessionAt(90, { id: "only" });
    expect(selectNextUpcomingSession([soon], NOW)?.id).toBe("only");
  });

  it("judges sessions by the passed now, not the real clock", () => {
    const ended = createEnrichedSessionAt(-62, { id: "ended" });
    Settings.now = () => NOW.minus({ minutes: 120 }).toMillis();
    expect(selectNextUpcomingSession([ended], NOW)).toBeUndefined();
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

