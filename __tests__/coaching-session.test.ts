import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import {
  isPastSession,
  isFutureSession,
  isUnderwaySession,
  isSessionToday,
  DEFAULT_SESSION_DURATION_MINUTES,
} from "@/types/coaching-session";
import { createSessionAt, createMockSession } from "./test-utils";

describe("isPastSession", () => {
  it("returns true when session duration has fully elapsed", () => {
    const session = createSessionAt(-120); // 2 hours ago
    expect(isPastSession(session)).toBe(true);
  });

  it("returns false when session is still within its duration window", () => {
    const session = createSessionAt(-30); // 30 min ago, within 60-min duration
    expect(isPastSession(session)).toBe(false);
  });

  it("returns false for a future session", () => {
    const session = createSessionAt(60);
    expect(isPastSession(session)).toBe(false);
  });

  it("returns true when now is past the custom cutoff", () => {
    const session = createSessionAt(-30); // 30 min ago, normally still active
    const cutoff = DateTime.now().minus({ minutes: 5 }); // cutoff was 5 min ago
    expect(isPastSession(session, { cutoff })).toBe(true);
  });

  it("returns false when now is before the custom cutoff", () => {
    const session = createSessionAt(-120); // 2 hours ago, normally past
    const cutoff = DateTime.now().plus({ hours: 1 }); // cutoff is 1 hour from now
    expect(isPastSession(session, { cutoff })).toBe(false);
  });

  it("uses end-of-day cutoff to keep same-day sessions editable", () => {
    const userTimezone = "America/New_York";
    const session = createSessionAt(-120); // 2 hours ago
    const endOfDay = DateTime.fromISO(session.date, { zone: 'utc' })
      .setZone(userTimezone)
      .endOf('day');
    // Session started today in the user's timezone, so end-of-day hasn't passed yet
    expect(isPastSession(session, { cutoff: endOfDay })).toBe(false);
  });

  it("end-of-day cutoff in a specific user timezone keeps same-day session editable", () => {
    // Simulate the exact pattern used in the coaching session page:
    // session date → convert to user timezone → end of that calendar day
    const userTimezone = "America/Chicago";
    const session = createSessionAt(-180); // 3 hours ago, well past default 60-min window
    const cutoff = DateTime.fromISO(session.date, { zone: 'utc' })
      .setZone(userTimezone)
      .endOf('day');
    // Still the same calendar day in the user's timezone
    expect(isPastSession(session, { cutoff })).toBe(false);
  });

  it("end-of-day cutoff marks yesterday's session as past", () => {
    const userTimezone = "America/Chicago";
    const yesterday = DateTime.now().setZone(userTimezone).minus({ days: 1 }).set({ hour: 14 });
    const session = createMockSession({
      date: yesterday.toUTC().toISO(),
    });
    const cutoff = DateTime.fromISO(session.date, { zone: 'utc' })
      .setZone(userTimezone)
      .endOf('day');
    expect(isPastSession(session, { cutoff })).toBe(true);
  });
});

describe("isFutureSession", () => {
  it("returns true when session has not started yet", () => {
    const session = createSessionAt(30);
    expect(isFutureSession(session)).toBe(true);
  });

  it("returns false when session start time has passed", () => {
    const session = createSessionAt(-10);
    expect(isFutureSession(session)).toBe(false);
  });
});

describe("isUnderwaySession", () => {
  it("returns true when session just started (within duration window)", () => {
    const session = createSessionAt(-1); // 1 minute ago
    expect(isUnderwaySession(session)).toBe(true);
  });

  it("returns true when session is midway through its duration", () => {
    const session = createSessionAt(-30); // 30 min into a 60-min session
    expect(isUnderwaySession(session)).toBe(true);
  });

  it("returns true near the end of the session duration", () => {
    const session = createSessionAt(-(DEFAULT_SESSION_DURATION_MINUTES - 1)); // 1 min before end
    expect(isUnderwaySession(session)).toBe(true);
  });

  it("returns false when session duration has fully elapsed", () => {
    const session = createSessionAt(-120); // 2 hours ago
    expect(isUnderwaySession(session)).toBe(false);
  });

  it("returns false when session has not started yet", () => {
    const session = createSessionAt(30);
    expect(isUnderwaySession(session)).toBe(false);
  });
});

describe("isSessionToday", () => {
  // Pin "now" to noon so +60 minutes never crosses midnight
  const originalNow = Settings.now;

  beforeEach(() => {
    const noon = DateTime.now().set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    Settings.now = () => noon.toMillis();
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it("returns true for a session scheduled today", () => {
    const session = createSessionAt(0); // right now (noon)
    expect(isSessionToday(session)).toBe(true);
  });

  it("returns true for a session later today", () => {
    const session = createSessionAt(60); // 1 hour from now (1 PM)
    expect(isSessionToday(session)).toBe(true);
  });
});
