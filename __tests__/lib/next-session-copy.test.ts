import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { nextSessionHeadline, nextSessionWhen } from "@/lib/next-session-copy";
import { SessionUrgency } from "@/types/session-display";

const at = (iso: string) => DateTime.fromISO(iso, { zone: "America/Chicago" });

describe("nextSessionHeadline", () => {
  const now = at("2026-11-19T12:00");

  it("labels a session later today", () => {
    expect(nextSessionHeadline("Justin", at("2026-11-19T15:05"), now)).toBe("Today with Justin at 3:05 PM");
  });

  it("labels a session tomorrow", () => {
    expect(nextSessionHeadline("Justin", at("2026-11-20T10:00"), now)).toBe("Tomorrow with Justin at 10:00 AM");
  });

  it("uses the weekday further out", () => {
    expect(nextSessionHeadline("Justin", at("2026-11-21T11:00"), now)).toBe("Saturday with Justin at 11:00 AM");
  });

  it("labels a session under way across midnight as yesterday", () => {
    expect(nextSessionHeadline("Justin", at("2026-11-19T23:30"), at("2026-11-20T00:10"))).toBe(
      "Yesterday with Justin at 11:30 PM"
    );
  });

  it("counts calendar days, not 24-hour spans", () => {
    expect(nextSessionHeadline("Justin", at("2026-11-20T00:15"), at("2026-11-19T23:50"))).toBe(
      "Tomorrow with Justin at 12:15 AM"
    );
  });

  it("counts calendar days across the fall-back DST change", () => {
    const saturday = at("2026-10-31T20:00");
    expect(nextSessionHeadline("Justin", at("2026-11-01T10:00"), saturday)).toBe("Tomorrow with Justin at 10:00 AM");
    expect(nextSessionHeadline("Justin", at("2026-11-02T09:00"), saturday)).toBe("Monday with Justin at 9:00 AM");
  });

  it("drops 'with' for an empty first name", () => {
    expect(nextSessionHeadline("", at("2026-11-19T15:05"), now)).toBe("Today at 3:05 PM");
  });
});

describe("nextSessionWhen", () => {
  const now = at("2026-11-19T12:00");

  it("counts down minutes when imminent", () => {
    expect(nextSessionWhen(at("2026-11-19T12:30"), now, SessionUrgency.Imminent)).toEqual({
      text: "Starts in 30 mins",
      hot: true,
    });
  });

  it("rounds seconds up to 1 min", () => {
    expect(nextSessionWhen(at("2026-11-19T12:00:30"), now, SessionUrgency.Imminent)).toEqual({
      text: "Starts in 1 min",
      hot: true,
    });
  });

  it("shows hours and minutes", () => {
    expect(nextSessionWhen(at("2026-11-19T14:45"), now, SessionUrgency.Later)).toEqual({
      text: "Starts in 2 h 45 mins",
      hot: false,
    });
  });

  it("shows whole hours", () => {
    expect(nextSessionWhen(at("2026-11-19T15:00"), now, SessionUrgency.Later)).toEqual({
      text: "Starts in 3 h",
      hot: false,
    });
  });

  it("uses the singular for one leftover minute", () => {
    expect(nextSessionWhen(at("2026-11-19T13:01"), now, SessionUrgency.Soon)).toEqual({
      text: "Starts in 1 h 1 min",
      hot: false,
    });
  });

  it("is under way once started, even while still imminent", () => {
    expect(nextSessionWhen(at("2026-11-19T11:58"), now, SessionUrgency.Imminent)).toEqual({
      text: "Currently under way",
      hot: true,
    });
  });

  it("is under way when underway", () => {
    expect(nextSessionWhen(at("2026-11-19T11:00"), now, SessionUrgency.Underway)).toEqual({
      text: "Currently under way",
      hot: true,
    });
  });

  it("shows the date for a later day", () => {
    expect(nextSessionWhen(at("2026-11-20T10:00"), now, SessionUrgency.Later)).toEqual({
      text: "Fri, Nov 20",
      hot: false,
    });
  });

  it("prefers the date over minutes across midnight", () => {
    expect(nextSessionWhen(at("2026-11-20T00:15"), at("2026-11-19T23:50"), SessionUrgency.Imminent)).toEqual({
      text: "Fri, Nov 20",
      hot: false,
    });
  });
});
