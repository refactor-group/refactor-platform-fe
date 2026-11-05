import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { TopicStatus } from "@/types/coaching-session-topic";
import {
  CoachingSessionInclude,
  serializeCoachingSession,
  transformCoachingSession,
} from "@/types/coaching-session";
import { calculateSessionUrgency } from "@/lib/utils/session";
import { SessionUrgency } from "@/types/session-display";

const wire = {
  id: "s-1",
  coaching_relationship_id: "rel-1",
  date: "2026-08-18T19:30:00",
  duration_minutes: 50,
  title: null,
  coaching_session_series_id: null,
  organization_id: "org-1",
  ical_recurrence_id: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

const topic = {
  id: "t-1",
  coaching_session_id: "s-1",
  user_id: "u-1",
  body: "Hiring plan",
  priority: null,
  status: "Discussed",
  moved_from_session_id: null,
  display_order: 3,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

describe("topics include", () => {
  it("asks the backend for topics by name", () => {
    expect(CoachingSessionInclude.Topics).toBe("topics");
  });

  it("parses included topics with the topic transform", () => {
    const session = transformCoachingSession({ ...wire, topics: [topic] });
    expect(session.topics).toHaveLength(1);
    expect(session.topics?.[0].status).toBe(TopicStatus.Discussed);
    expect(session.topics?.[0]).not.toHaveProperty("display_order");
  });

  it("leaves topics undefined when they were not included", () => {
    expect(transformCoachingSession(wire).topics).toBeUndefined();
  });

  it("never sends topics back to the backend", () => {
    const session = transformCoachingSession({ ...wire, topics: [topic] });
    expect(serializeCoachingSession(session)).not.toHaveProperty("topics");
  });
});

describe("calculateSessionUrgency with an explicit now", () => {
  const session = transformCoachingSession(wire);

  it("measures from the given instant instead of the wall clock", () => {
    const now = DateTime.fromISO("2026-08-18T18:45:00Z");
    expect(calculateSessionUrgency(session, now)).toBe(SessionUrgency.Soon);
    expect(calculateSessionUrgency(session, now.plus({ minutes: 20 }))).toBe(SessionUrgency.Imminent);
    expect(calculateSessionUrgency(session, now.plus({ hours: 2 }))).toBe(SessionUrgency.Past);
  });
});
