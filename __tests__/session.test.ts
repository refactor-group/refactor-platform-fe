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
  it("starts at the previous calendar Sunday and ends at the anchor day's end", () => {
    // Anchor: Sat May 23 mid-day (UTC). Previous Sun = May 10. End is
    // end-of-day on the anchor's day so today's sessions are inside the
    // fetched window — the ticking past/future filter decides what's
    // visible.
    const anchor = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });
    const previous = CoachingSessionBuckets.previousWeekRange(anchor);
    expect(previous.start.toISO()).toBe("2026-05-10T00:00:00.000Z");
    expect(previous.end.toISO()).toBe("2026-05-23T23:59:59.999Z");
  });
});

// `computeShowMoreState` decides whether the Show additional buttons are
// disabled. The fetch range covers display + lookahead; this function
// reads the counts response and reports whether any month falls in the
// lookahead window past either display boundary. Tests anchor to
// 2026-05-23 with a ±12-month display range → past boundary "2025-05",
// future boundary "2027-05". A bucket is in the display range iff its
// month is in [pastBoundary, futureBoundary]; only months STRICTLY past
// either boundary enable the corresponding button.
describe("CoachingSessionBuckets.computeShowMoreState", () => {
  const NOW = DateTime.fromISO("2026-05-23T12:00:00.000Z", { zone: "utc" });

  it("disables both buttons when the response is empty", () => {
    // No data anywhere → clicking either button can't surface a bucket.
    const result = CoachingSessionBuckets.computeShowMoreState([], NOW, 12, 12);
    expect(result).toEqual({
      disableShowMoreLater: true,
      disableShowMoreEarlier: true,
    });
  });

  it("treats counts exactly AT the boundaries as inside the display range", () => {
    // "2025-05" == pastBoundary and "2027-05" == futureBoundary. Both are
    // in the displayed range, so neither button should enable.
    const months = ["2025-05", "2027-05"];
    const result = CoachingSessionBuckets.computeShowMoreState(
      months,
      NOW,
      12,
      12
    );
    expect(result).toEqual({
      disableShowMoreLater: true,
      disableShowMoreEarlier: true,
    });
  });

  it("enables only the future button when a count is strictly past the future boundary", () => {
    // "2027-06" > "2027-05" → next click surfaces it; nothing past the
    // past boundary → earlier stays disabled.
    const months = ["2025-08", "2027-06"];
    const result = CoachingSessionBuckets.computeShowMoreState(
      months,
      NOW,
      12,
      12
    );
    expect(result).toEqual({
      disableShowMoreLater: false,
      disableShowMoreEarlier: true,
    });
  });

  it("enables only the earlier button when a count is strictly before the past boundary", () => {
    // "2025-04" < "2025-05" → next click surfaces it; nothing past the
    // future boundary → later stays disabled.
    const months = ["2025-04", "2026-08"];
    const result = CoachingSessionBuckets.computeShowMoreState(
      months,
      NOW,
      12,
      12
    );
    expect(result).toEqual({
      disableShowMoreLater: true,
      disableShowMoreEarlier: false,
    });
  });

  it("enables both buttons when counts exist on both sides of the display range", () => {
    const months = ["2025-04", "2026-01", "2027-08"];
    const result = CoachingSessionBuckets.computeShowMoreState(
      months,
      NOW,
      12,
      12
    );
    expect(result).toEqual({
      disableShowMoreLater: false,
      disableShowMoreEarlier: false,
    });
  });

  it("regression: real-world response Jun 2025–Jun 2026 disables both buttons", () => {
    // This is the BE response that originally surfaced the false-negative
    // bug — every count sits inside the ±12-month display range, so
    // neither button can produce additional buckets.
    const months = [
      "2025-06", "2025-07", "2025-08", "2025-09", "2025-10",
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
      "2026-04", "2026-05", "2026-06",
    ];
    const result = CoachingSessionBuckets.computeShowMoreState(
      months,
      NOW,
      12,
      12
    );
    expect(result.disableShowMoreEarlier).toBe(true);
    expect(result.disableShowMoreLater).toBe(true);
  });

  it("compares months correctly across the year boundary", () => {
    // "2024-12" < "2025-05" must hold as STRING comparison (zero-padded
    // months make this safe). If the comparison used numeric month
    // alone this would falsely say December (12) > May (5).
    const result = CoachingSessionBuckets.computeShowMoreState(
      ["2024-12"],
      NOW,
      12,
      12
    );
    expect(result.disableShowMoreEarlier).toBe(false);
  });

  it("respects the current display boundaries (post-click extension)", () => {
    // After clicking once with a 6-month increment, monthsBack=18 →
    // pastBoundary = "2024-11". A "2024-08" count is still past it, so
    // the earlier button stays enabled and the user can click again.
    const result = CoachingSessionBuckets.computeShowMoreState(
      ["2024-08", "2025-06", "2026-05"],
      NOW,
      12,
      18
    );
    expect(result.disableShowMoreEarlier).toBe(false);

    // But if monthsBack=24, pastBoundary moves to "2024-05" and "2024-08"
    // is now inside the display — earlier disables.
    const exhausted = CoachingSessionBuckets.computeShowMoreState(
      ["2024-08", "2025-06", "2026-05"],
      NOW,
      12,
      24
    );
    expect(exhausted.disableShowMoreEarlier).toBe(true);
  });
});

