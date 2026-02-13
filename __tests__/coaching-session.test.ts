import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import {
  isPastSession,
  isFutureSession,
  isUnderwaySession,
  isSessionToday,
  DEFAULT_SESSION_DURATION_MINUTES,
} from "@/types/coaching-session";
import { createSessionAt } from "./test-utils";

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
