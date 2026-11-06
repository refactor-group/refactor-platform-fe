import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { createMockEnrichedSession } from "../../test-utils";
import { CardClick, CardTense, cardClick, cardView, readOnlyView } from "@/lib/week-grid/card";

// Tuesday, August 18 2026, 1:45 PM in Chicago.
const NOW = DateTime.fromISO("2026-08-18T18:45:00Z", { zone: "utc" });
const COACH = { viewerId: "coach-1", now: NOW, timezone: "America/Chicago" };
const COACHEE = { ...COACH, viewerId: "coachee-1" };
const at = (utc: string) => createMockEnrichedSession({ date: utc, duration_minutes: 50 });

// 10:00 AM today, over by 10:50.
const ENDED_TODAY = at("2026-08-18T15:00:00");
// 10:00 AM yesterday.
const YESTERDAY = at("2026-08-17T15:00:00");
// 9:00 PM yesterday in Chicago, which is already today in UTC.
const LATE_YESTERDAY = at("2026-08-18T02:00:00");
const TOMORROW = at("2026-08-19T15:00:00");

describe("editable", () => {
  it("is true for any session that hasn't ended", () => {
    expect(cardView(TOMORROW, COACH).editable).toBe(true);
  });

  it("stays true for a session that ended earlier today, which still looks past", () => {
    const view = cardView(ENDED_TODAY, COACH);
    expect(view.tense).toBe(CardTense.Past);
    expect(view.editable).toBe(true);
  });

  it("judges today in the viewer's zone, not UTC", () => {
    expect(cardView(LATE_YESTERDAY, COACH).editable).toBe(false);
  });

  it("is false for a session from an earlier day", () => {
    expect(cardView(YESTERDAY, COACH).editable).toBe(false);
  });
});

describe("cardClick with today's ended sessions", () => {
  it("reschedules a session the viewer coaches that ended earlier today", () => {
    expect(cardClick(cardView(ENDED_TODAY, COACH))).toBe(CardClick.Reschedule);
  });

  it("still does nothing for a coachee, an earlier day, or read only", () => {
    expect(cardClick(cardView(ENDED_TODAY, COACHEE))).toBe(CardClick.Nothing);
    expect(cardClick(cardView(YESTERDAY, COACH))).toBe(CardClick.Nothing);
    expect(cardClick(readOnlyView(cardView(ENDED_TODAY, COACH)))).toBe(CardClick.Nothing);
  });
});
