import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
  enrichSessionForDisplay,
  selectNextUpcomingSession,
  getSessionParticipantInfo,
  getSessionParticipantName,
  CoachingSessionBuckets,
  IMMINENT_SESSION_THRESHOLD_MINUTES,
  SOON_SESSION_THRESHOLD_MINUTES,
} from "@/lib/utils/session";
import { CoachingSessionBucketKind } from "@/types/coaching-session-bucket";
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
    expect(info?.isMissing).toBe(true);
  });

  it("falls back to display_name when the loaded user has empty first/last names", () => {
    const session = createMockEnrichedSession({
      coachee: {
        id: "coachee-1",
        email: "alex@example.com",
        first_name: "",
        last_name: "",
        display_name: "A. Chen",
        timezone: "America/Los_Angeles",
        role: "user",
        roles: [],
        created_at: "",
        updated_at: "",
      },
    });
    const info = getSessionParticipantInfo(session, "coach-1");
    expect(info).not.toBeNull();
    expect(info?.participantName).toBe("A. Chen");
    expect(info?.isMissing).toBe(false);
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

  it("returns display_name when the loaded user has empty first/last names (regression)", () => {
    const session = createMockEnrichedSession({
      coachee: {
        id: "coachee-1",
        email: "alex@example.com",
        first_name: "",
        last_name: "",
        display_name: "A. Chen",
        timezone: "America/Los_Angeles",
        role: "user",
        roles: [],
        created_at: "",
        updated_at: "",
      },
    });
    expect(getSessionParticipantName(session, "coach-1")).toBe("A. Chen");
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

describe("CoachingSessionBuckets.generate", () => {
  const originalNow = Settings.now;
  const originalZone = Settings.defaultZone;

  beforeEach(() => {
    Settings.defaultZone = "utc";
    const fakeNow = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    Settings.now = () => fakeNow.toMillis();
  });

  afterEach(() => {
    Settings.now = originalNow;
    Settings.defaultZone = originalZone;
  });

  it("aligns the current bucket to the May-June (odd-month-start) grid for a May anchor", () => {
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 4, 4);
    const current = buckets.find((b) => b.start <= anchor && anchor <= b.end);
    expect(current).toBeDefined();
    expect(current!.start.toISO()).toBe("2026-05-01T00:00:00.000Z");
    expect(current!.end.toFormat("yyyy-MM-dd")).toBe("2026-06-30");
  });

  it("puts a June anchor into the same May-June bucket as a May anchor", () => {
    const anchor = DateTime.fromISO("2026-06-15T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 4, 4);
    const current = buckets.find((b) => b.start <= anchor && anchor <= b.end);
    expect(current!.start.toISO()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("puts a July anchor into the Jul-Aug bucket (next odd-month grid cell)", () => {
    const anchor = DateTime.fromISO("2026-07-10T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 4, 4);
    const current = buckets.find((b) => b.start <= anchor && anchor <= b.end);
    expect(current!.start.toISO()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("formats labels with day precision (May 1 – Jun 30)", () => {
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 4, 4);
    const current = buckets.find((b) => b.start <= anchor && anchor <= b.end);
    expect(current!.label).toBe("May 1 – Jun 30");
  });

  it("marks past buckets with BucketKind.Past and future-or-current with BucketKind.Future", () => {
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 4, 4);
    const current = buckets.find((b) => b.start <= anchor && anchor <= b.end)!;
    const past = buckets.find((b) => b.end < current.start);
    const future = buckets.find((b) => b.start > current.end);
    expect(current.kind).toBe(CoachingSessionBucketKind.Future);
    expect(past!.kind).toBe(CoachingSessionBucketKind.Past);
    expect(future!.kind).toBe(CoachingSessionBucketKind.Future);
  });

  it("returns ceil(monthsForward/2)+1 future-or-current buckets and ceil(monthsBack/2) past buckets", () => {
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 12, 12);
    const futureOrCurrent = buckets.filter(
      (b) => b.kind === CoachingSessionBucketKind.Future
    );
    const past = buckets.filter((b) => b.kind === CoachingSessionBucketKind.Past);
    expect(futureOrCurrent).toHaveLength(7);
    expect(past).toHaveLength(6);
  });
});

describe("CoachingSessionBuckets.detectYearDividers", () => {
  it("marks the first bucket whose start.year differs from its predecessor's", () => {
    const anchor = DateTime.fromISO("2026-11-15T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 6, 0);
    const sorted = [...buckets].sort(
      (a, b) => a.start.toMillis() - b.start.toMillis()
    );
    const annotated = CoachingSessionBuckets.detectYearDividers(sorted);
    const yearShifts = annotated.filter((b) => b.crossesYearFromPrevious);
    expect(yearShifts).toHaveLength(1);
    expect(yearShifts[0].start.year).toBe(2027);
  });

  it("never marks the first bucket as crossing the year", () => {
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const buckets = CoachingSessionBuckets.generate(anchor, 4, 0);
    const annotated = CoachingSessionBuckets.detectYearDividers(buckets);
    expect(annotated[0].crossesYearFromPrevious).toBe(false);
  });
});

describe("CoachingSessionBuckets.currentWeekRange", () => {
  const originalNow = Settings.now;
  const originalZone = Settings.defaultZone;

  afterEach(() => {
    Settings.now = originalNow;
    Settings.defaultZone = originalZone;
  });

  it("returns Sunday 00:00 through Saturday 23:59:59.999 for a midweek anchor (Sat 2026-05-23 UTC)", () => {
    // 2026-05-23 is a Saturday (weekday 6 in Luxon, 1=Mon)
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const { start, end } = CoachingSessionBuckets.currentWeekRange(anchor);
    expect(start.toISO()).toBe("2026-05-17T00:00:00.000Z"); // Sunday before
    expect(end.toISO()).toBe("2026-05-23T23:59:59.999Z"); // Same Saturday
  });

  it("treats a Sunday anchor as the start of its own week", () => {
    // 2026-05-24 is a Sunday (weekday 7)
    const anchor = DateTime.fromISO("2026-05-24T08:00:00.000Z", { zone: "utc" });
    const { start, end } = CoachingSessionBuckets.currentWeekRange(anchor);
    expect(start.toISO()).toBe("2026-05-24T00:00:00.000Z");
    expect(end.toISO()).toBe("2026-05-30T23:59:59.999Z");
  });

  it("treats a Monday anchor as one day past Sunday", () => {
    // 2026-05-25 is a Monday (weekday 1)
    const anchor = DateTime.fromISO("2026-05-25T08:00:00.000Z", { zone: "utc" });
    const { start } = CoachingSessionBuckets.currentWeekRange(anchor);
    expect(start.toISO()).toBe("2026-05-24T00:00:00.000Z"); // Sunday
  });
});

describe("CoachingSessionBuckets.previousWeekRange", () => {
  it("returns the Sunday-Saturday week immediately before currentWeekRange", () => {
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const previous = CoachingSessionBuckets.previousWeekRange(anchor);
    expect(previous.start.toISO()).toBe("2026-05-10T00:00:00.000Z");
    expect(previous.end.toISO()).toBe("2026-05-16T23:59:59.999Z");
  });
});

// `detectExhaustion` decides whether the Show-additional buttons should
// be hidden. Tests anchor everything to May 23 2026 with a ±12 month
// window unless otherwise stated. Past boundary = "2025-05", future
// boundary = "2027-05".
describe("CoachingSessionBuckets.detectExhaustion — initial load", () => {
  const NOW = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });

  it("hides both buttons when the response is empty (no data at all)", () => {
    const result = CoachingSessionBuckets.detectExhaustion([], NOW, 12, 12);
    expect(result).toEqual({ outOfFuture: true, outOfPast: true });
  });

  it("keeps both buttons visible when data reaches both boundaries (gap = 0)", () => {
    const months = ["2025-05", "2026-05", "2027-05"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result).toEqual({ outOfFuture: false, outOfPast: false });
  });

  it("keeps past button visible at a 1-month gap (below threshold)", () => {
    // Past boundary "2025-05"; earliest data "2025-06" → 1 month gap.
    const months = ["2025-06", "2026-05"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfPast).toBe(false);
  });

  it("keeps past button visible at a 2-month gap (below threshold)", () => {
    // Past boundary "2025-05"; earliest data "2025-07" → 2 month gap.
    const months = ["2025-07", "2026-05"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfPast).toBe(false);
  });

  it("hides past button at exactly the 3-month gap threshold", () => {
    // Past boundary "2025-05"; earliest data "2025-08" → 3 month gap.
    const months = ["2025-08", "2026-05"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfPast).toBe(true);
  });

  it("hides past button at large past gap (8 months)", () => {
    // Earliest "2026-01" → boundary "2025-05" → 8 month gap.
    const months = ["2026-01", "2026-05"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfPast).toBe(true);
  });

  it("keeps future button visible at a 1-month gap from future boundary", () => {
    // Future boundary "2027-05"; latest "2027-04" → 1 month gap.
    const months = ["2025-05", "2027-04"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfFuture).toBe(false);
  });

  it("hides future button at exactly the 3-month gap threshold", () => {
    // Future boundary "2027-05"; latest "2027-02" → 3 month gap.
    const months = ["2025-05", "2027-02"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfFuture).toBe(true);
  });

  it("checks each direction independently — future exhausted, past visible", () => {
    // Only past-side data; future side empty.
    const months = ["2025-05", "2025-08", "2025-11"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfFuture).toBe(true);
    expect(result.outOfPast).toBe(false);
  });

  it("checks each direction independently — past exhausted, future visible", () => {
    // Only future-side data; past side empty up to boundary.
    const months = ["2026-08", "2027-05"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfPast).toBe(true);
    expect(result.outOfFuture).toBe(false);
  });

  it("matches the real-world all-relationships case (data Jun 2025 – Jun 2026)", () => {
    // Past gap ≈ 1mo → keep past visible; future gap ≈ 11mo → hide future.
    const months = [
      "2025-06", "2025-07", "2025-08", "2025-09", "2025-10",
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
      "2026-04", "2026-05", "2026-06",
    ];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfPast).toBe(false);
    expect(result.outOfFuture).toBe(true);
  });

  it("matches the James-only case (single session in current month)", () => {
    // Single entry at current month — gap is 12 in both directions.
    const months = ["2026-05"];
    const result = CoachingSessionBuckets.detectExhaustion(months, NOW, 12, 12);
    expect(result.outOfPast).toBe(true);
    expect(result.outOfFuture).toBe(true);
  });
});

describe("CoachingSessionBuckets.detectExhaustion — post-click later", () => {
  const NOW = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });

  it("evaluates only outOfFuture (outOfPast left undefined)", () => {
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2025-06", "2026-06"],
      NOW,
      24,
      12,
      { pendingDirection: "later", previousMonthsForward: 12 }
    );
    expect(result.outOfFuture).toBeDefined();
    expect(result.outOfPast).toBeUndefined();
  });

  it("hides future when extension brings no new months past previous boundary", () => {
    // Prev boundary "2027-05"; response latest "2026-06" ≤ "2027-05".
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2025-06", "2026-06"],
      NOW,
      24,
      12,
      { pendingDirection: "later", previousMonthsForward: 12 }
    );
    expect(result.outOfFuture).toBe(true);
  });

  it("keeps future visible when extension reveals months past previous boundary", () => {
    // Prev boundary "2027-05"; response latest "2027-08" > "2027-05".
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2025-06", "2026-06", "2027-08"],
      NOW,
      24,
      12,
      { pendingDirection: "later", previousMonthsForward: 12 }
    );
    expect(result.outOfFuture).toBe(false);
  });

  it("treats latest == previous boundary as exhausted (no STRICTLY-greater month)", () => {
    // Latest "2027-05" equals prev boundary → no months STRICTLY past it.
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2025-06", "2027-05"],
      NOW,
      24,
      12,
      { pendingDirection: "later", previousMonthsForward: 12 }
    );
    expect(result.outOfFuture).toBe(true);
  });

  it("hides future when response is empty", () => {
    const result = CoachingSessionBuckets.detectExhaustion([], NOW, 24, 12, {
      pendingDirection: "later",
      previousMonthsForward: 12,
    });
    expect(result.outOfFuture).toBe(true);
  });
});

describe("CoachingSessionBuckets.detectExhaustion — post-click earlier", () => {
  const NOW = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });

  it("evaluates only outOfPast (outOfFuture left undefined)", () => {
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2025-06", "2026-06"],
      NOW,
      12,
      24,
      { pendingDirection: "earlier", previousMonthsBack: 12 }
    );
    expect(result.outOfPast).toBeDefined();
    expect(result.outOfFuture).toBeUndefined();
  });

  it("hides past when extension brings no new months before previous boundary", () => {
    // Prev boundary "2025-05"; earliest "2025-06" ≥ "2025-05".
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2025-06", "2026-06"],
      NOW,
      12,
      24,
      { pendingDirection: "earlier", previousMonthsBack: 12 }
    );
    expect(result.outOfPast).toBe(true);
  });

  it("keeps past visible when extension reveals months before previous boundary", () => {
    // Prev boundary "2025-05"; response includes "2024-12" < "2025-05".
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2024-12", "2025-06", "2026-06"],
      NOW,
      12,
      24,
      { pendingDirection: "earlier", previousMonthsBack: 12 }
    );
    expect(result.outOfPast).toBe(false);
  });

  it("treats earliest == previous boundary as exhausted", () => {
    const result = CoachingSessionBuckets.detectExhaustion(
      ["2025-05", "2026-06"],
      NOW,
      12,
      24,
      { pendingDirection: "earlier", previousMonthsBack: 12 }
    );
    expect(result.outOfPast).toBe(true);
  });
});

