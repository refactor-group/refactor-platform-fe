import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { Some } from "@/types/option";
import { COACHEE_VIEWER, COLLEAGUE_VIEWER, createMockEnrichedSession } from "../../test-utils";
import type { RelationshipViewer } from "@/types/coaching-relationship";
import { defaultCoachingSessionTopic } from "@/types/coaching-session-topic";
import { CardFooter, CardTense, cardNoteText, cardView, type CardContext } from "@/lib/week-grid/card";

const TZ = "America/Chicago";
// 1:45 PM in Chicago.
const NOW = DateTime.fromISO("2026-08-18T18:45:00Z", { zone: "utc" });
const COACH: CardContext = { viewerId: "coach-1", now: NOW, timezone: TZ };
const COACHEE: CardContext = { viewerId: "coachee-1", now: NOW, timezone: TZ };

const topics = (n: number) => Array.from({ length: n }, () => defaultCoachingSessionTopic());

// Backend dates are naive UTC strings.
function session(utc: string, topicCount: number, minutes = 50) {
  return createMockEnrichedSession({ date: utc, duration_minutes: minutes, topics: Some(topics(topicCount)) });
}

describe("cardView", () => {
  it("shows the start in the viewer's zone", () => {
    const view = cardView(session("2026-08-18T21:30:00", 0), COACH);
    expect(view.start.zoneName).toBe(TZ);
    expect(view.start.toFormat("HH:mm")).toBe("16:30");
  });

  it("names the other person and grants management as the backend says", () => {
    const s = session("2026-08-18T21:30:00", 0);
    const seenBy = (viewer: RelationshipViewer) => ({ ...s, relationship: { ...s.relationship!, viewer } });
    expect(cardView(s, COACH).name).toBe("Alex Chen");
    expect(cardView(s, COACH).canManage).toBe(true);
    expect(cardView(seenBy(COACHEE_VIEWER), COACHEE).name).toBe("Jim Hodapp");
    expect(cardView(seenBy(COACHEE_VIEWER), COACHEE).canManage).toBe(false);
    expect(cardView(seenBy(COLLEAGUE_VIEWER), COACHEE).canManage).toBe(true);
  });

  it("is Live with a pulsing relative note when the session starts soon", () => {
    const view = cardView(session("2026-08-18T19:30:00", 0), COACH);
    expect(view.tense).toBe(CardTense.Live);
    expect(view.note).toEqual({ kind: "relative", text: "in 45 min", pulse: true, topicCount: 0 });
  });

  it("knows whether the session has started: not while it's only coming up soon", () => {
    expect(cardView(session("2026-08-18T19:30:00", 0), COACH).started).toBe(false);
    expect(cardView(session("2026-08-18T18:30:00", 0), COACH).started).toBe(true);
    expect(cardView(session("2026-08-18T21:30:00", 0), COACH).started).toBe(false);
  });

  it("reads now while the session is under way", () => {
    const view = cardView(session("2026-08-18T18:30:00", 2), COACH);
    expect(view.tense).toBe(CardTense.Live);
    expect(view.note).toEqual({ kind: "relative", text: "now", pulse: true, topicCount: 2 });
  });

  it("writes hours and minutes for a start more than an hour away", () => {
    expect(cardView(session("2026-08-18T20:05:00", 0), COACH).note).toEqual({
      kind: "relative",
      text: "in 1 hr 20 min",
      pulse: true,
      topicCount: 0,
    });
    expect(cardView(session("2026-08-18T20:45:00", 0), COACH).note).toEqual({
      kind: "relative",
      text: "in 2 hr",
      pulse: true,
      topicCount: 0,
    });
  });

  it("is Upcoming with a topic count further out", () => {
    const view = cardView(session("2026-08-19T15:00:00", 3), COACH);
    expect(view.tense).toBe(CardTense.Upcoming);
    expect(view.note).toEqual({ kind: "topics", count: 3 });
  });

  it("flags an upcoming session with no topics", () => {
    expect(cardView(session("2026-08-19T15:00:00", 0), COACH).note).toEqual({ kind: "noTopics" });
  });

  it("treats a missing topics include as no topics", () => {
    const s = createMockEnrichedSession({ date: "2026-08-19T15:00:00", duration_minutes: 50 });
    expect(cardView(s, COACH).note).toEqual({ kind: "noTopics" });
    expect(cardView(s, COACH).footer).toBe(CardFooter.Prepare);
  });

  it("is Ready with at least one topic and Prepare without", () => {
    expect(cardView(session("2026-08-19T15:00:00", 1), COACH).footer).toBe(CardFooter.Ready);
    expect(cardView(session("2026-08-19T15:00:00", 0), COACH).footer).toBe(CardFooter.Prepare);
  });

  it("is Past and Done once the session has ended, keeping its topic count", () => {
    const view = cardView(session("2026-08-17T15:00:00", 2), COACH);
    expect(view.tense).toBe(CardTense.Past);
    expect(view.footer).toBe(CardFooter.Done);
    expect(view.note).toEqual({ kind: "topics", count: 2 });
  });

  it("is not Past until the full duration has elapsed", () => {
    // Started 40 minutes ago, runs 50.
    expect(cardView(session("2026-08-18T18:05:00", 0), COACH).tense).toBe(CardTense.Live);
  });
});

describe("cardNoteText", () => {
  it.each([
    [{ kind: "relative" as const, text: "in 45 min", pulse: true, topicCount: 0 }, "in 45 min · No topics yet"],
    [{ kind: "relative" as const, text: "now", pulse: true, topicCount: 1 }, "now · 1 topic"],
    [{ kind: "relative" as const, text: "in 1 hr 20 min", pulse: true, topicCount: 3 }, "in 1 hr 20 min · 3 topics"],
    [{ kind: "topics" as const, count: 1 }, "1 topic"],
    [{ kind: "topics" as const, count: 3 }, "3 topics"],
    [{ kind: "topics" as const, count: 0 }, "No topics"],
    [{ kind: "noTopics" as const }, "No topics yet"],
  ])("%o reads %s", (note, text) => {
    expect(cardNoteText(note)).toBe(text);
  });
});

describe("cardView schedulingOpen", () => {
  const blockedBy = (userId: string | null) => {
    const s = session("2026-08-18T21:30:00", 0);
    return { ...s, relationship: { ...s.relationship!, scheduling_blocked_by: userId } };
  };

  it("closes scheduling when the backend names someone who left", () => {
    expect(cardView(blockedBy("coachee-1"), COACH).schedulingOpen).toBe(false);
    expect(cardView(blockedBy(null), COACH).schedulingOpen).toBe(true);
  });
});
