import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { createMockEnrichedSession } from "../../test-utils";
import { CardClick, cardClick, cardView, type CardContext } from "@/lib/week-grid/card";

const NOW = DateTime.fromISO("2026-08-18T18:45:00Z", { zone: "utc" });
const COACH: CardContext = { viewerId: "coach-1", now: NOW, timezone: "America/Chicago" };
const COACHEE: CardContext = { ...COACH, viewerId: "coachee-1" };
const upcoming = createMockEnrichedSession({ date: "2026-08-19T15:00:00", duration_minutes: 50 });
const live = createMockEnrichedSession({ date: "2026-08-18T19:30:00", duration_minutes: 50 });
// Started 20 minutes ago.
const underway = createMockEnrichedSession({ date: "2026-08-18T18:25:00", duration_minutes: 50 });
const past = createMockEnrichedSession({ date: "2026-08-17T15:00:00", duration_minutes: 50 });

describe("cardClick", () => {
  it("reschedules an upcoming or live session the viewer coaches", () => {
    expect(cardClick(cardView(upcoming, COACH))).toBe(CardClick.Reschedule);
    expect(cardClick(cardView(live, COACH))).toBe(CardClick.Reschedule);
  });

  it("does nothing on a past session until the Session glance is designed", () => {
    expect(cardClick(cardView(past, COACH))).toBe(CardClick.Nothing);
    expect(cardClick(cardView(past, COACHEE))).toBe(CardClick.Nothing);
  });

  it("opens a session that's under way, for anyone", () => {
    expect(cardClick(cardView(underway, COACH))).toBe(CardClick.Open);
    expect(cardClick(cardView(underway, COACHEE))).toBe(CardClick.Open);
  });

  it("does nothing on an upcoming session the viewer is coached in", () => {
    expect(cardClick(cardView(upcoming, COACHEE))).toBe(CardClick.Nothing);
  });
});
