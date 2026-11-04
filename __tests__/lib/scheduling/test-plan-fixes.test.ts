import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { SessionWrite, sessionWriteFailure } from "@/lib/api/coaching-session-errors";
import { DEFAULT_WORKING_HOURS, nextFreeStart } from "@/lib/scheduling";
import { whoSubline } from "@/lib/scheduling-copy";
import { EntityApiError } from "@/types/entity-api-error";
import { None, Some } from "@/types/option";
import { Frequency, MAX_OCCURRENCES, MAX_SPAN_DAYS, Weekday, validateRecurrence } from "@/types/recurrence";
import { NOW, at, busy } from "./fixtures";

describe("whoSubline: a first session soon", () => {
  it("says today for a first session later today", () => {
    expect(whoSubline({ usual: None, next: Some(at("2026-08-17T15:00")), last: None }, NOW)).toBe(
      "First session today"
    );
  });

  it("says tomorrow for a first session tomorrow", () => {
    expect(whoSubline({ usual: None, next: Some(at("2026-08-18T09:00")), last: None }, NOW)).toBe(
      "First session tomorrow"
    );
  });

  it("keeps the weekday further into the week", () => {
    expect(whoSubline({ usual: None, next: Some(at("2026-08-19T09:00")), last: None }, NOW)).toBe(
      "First session Wednesday"
    );
  });
});

describe("nextFreeStart: outside working hours", () => {
  const evening = busy("s-eve", "Blake Today", "2026-08-18T18:00", "2026-08-18T18:50");

  it("offers the next free start that evening when the chosen time is already past the working day", () => {
    const slot = { start: at("2026-08-18T18:00"), minutes: 60 };
    expect(nextFreeStart(slot, [evening], DEFAULT_WORKING_HOURS)).toEqual(Some(at("2026-08-18T19:00")));
  });

  it("never runs past midnight", () => {
    const late = busy("s-late", "Blake Today", "2026-08-18T23:00", "2026-08-18T23:50");
    const slot = { start: at("2026-08-18T23:00"), minutes: 60 };
    expect(nextFreeStart(slot, [late], DEFAULT_WORKING_HOURS)).toEqual(None);
  });

  it("still keeps a working-hours choice inside working hours", () => {
    const afternoon = busy("s-pm", "Priya Raman", "2026-08-18T16:00", "2026-08-18T16:50");
    const slot = { start: at("2026-08-18T16:00"), minutes: 60 };
    expect(nextFreeStart(slot, [afternoon], DEFAULT_WORKING_HOURS)).toEqual(None);
  });
});

describe("validateRecurrence: copy", () => {
  const TZ = "America/Chicago";
  const start = DateTime.fromISO("2026-06-10T10:00:00", { zone: TZ });
  const input = {
    frequency: Frequency.Weekly,
    interval: 1,
    byWeekdays: [Weekday.Wed],
    end: { kind: "count", count: 4 } as { kind: "count"; count: number } | { kind: "until"; until: string },
    start,
    startWeekday: Weekday.Wed,
    timezone: TZ,
  };

  it("talks about sessions, not occurrences", () => {
    expect(validateRecurrence({ ...input, end: { kind: "count", count: 0 } })).toBe("Enter at least 1 session.");
  });

  it("names no cap when there are too many sessions", () => {
    expect(validateRecurrence({ ...input, end: { kind: "count", count: MAX_OCCURRENCES + 1 } })).toBe(
      "That's too many sessions. End the series sooner."
    );
  });

  it("names no window when the end date is too far out", () => {
    const tooFar = start.plus({ days: MAX_SPAN_DAYS }).toFormat("yyyy-MM-dd");
    expect(validateRecurrence({ ...input, end: { kind: "until", until: tooFar } })).toBe(
      "That end date is too far out. Pick an earlier one."
    );
  });
});

describe("sessionWriteFailure: fallback", () => {
  const serverError = () =>
    new EntityApiError(
      "POST",
      "/coaching_sessions",
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 500, statusText: "Error", data: {} },
      })
    );

  it("says session, like every other session write message", () => {
    expect(sessionWriteFailure(serverError(), SessionWrite.Create)).toEqual({
      kind: "toast",
      message: "Couldn't create the session · Try again",
    });
    expect(sessionWriteFailure(serverError(), SessionWrite.RescheduleSeries)).toEqual({
      kind: "toast",
      message: "Couldn't update the session · Try again",
    });
  });
});
