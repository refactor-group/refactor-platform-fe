import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { byActivity, personActivity, whenLine } from "@/lib/person-activity";
import { None, Some } from "@/types/option";

const at = (iso: string) => DateTime.fromISO(iso, { zone: "America/Chicago" });
const NOW = at("2026-08-25T14:00");
const upcoming = (iso: string) => ({ start: at(iso), over: false });
const past = (iso: string) => ({ start: at(iso), over: true });

describe("personActivity", () => {
  it("takes the earliest session that hasn't ended, including one under way", () => {
    expect(personActivity([upcoming("2026-09-01T10:00"), upcoming("2026-08-25T13:30")], NOW)).toEqual({
      kind: "upcoming",
      next: at("2026-08-25T13:30"),
    });
  });

  it("stays active for 30 days after the last session", () => {
    expect(personActivity([past("2026-07-26T14:00")], NOW).kind).toBe("recent");
    expect(personActivity([past("2026-07-25T13:00")], NOW)).toEqual({
      kind: "inactive",
      last: Some(at("2026-07-25T13:00")),
    });
  });

  it("is inactive with no sessions", () => {
    expect(personActivity([], NOW)).toEqual({ kind: "inactive", last: None });
  });
});

describe("whenLine", () => {
  it("shows today's time in the accent, lowercase with no space", () => {
    expect(whenLine({ kind: "upcoming", next: at("2026-08-25T14:30") }, NOW)).toEqual({ text: "2:30pm", tone: "accent", past: false });
  });

  it("shows a weekday within the week and a date after it", () => {
    expect(whenLine({ kind: "upcoming", next: at("2026-08-31T09:00") }, NOW)).toEqual({ text: "Mon", tone: "muted", past: false });
    expect(whenLine({ kind: "upcoming", next: at("2026-09-01T09:00") }, NOW)).toEqual({ text: "Sep 1", tone: "muted", past: false });
  });

  it("shows a past session as its faint date alone, so it fits", () => {
    expect(whenLine({ kind: "recent", last: at("2026-08-11T10:00") }, NOW)).toEqual({ text: "Aug 11", tone: "faint", past: true });
    expect(whenLine({ kind: "inactive", last: Some(at("2026-06-16T10:00")) }, NOW)).toEqual({ text: "Jun 16", tone: "faint", past: true });
    expect(whenLine({ kind: "inactive", last: None }, NOW)).toEqual({ text: "No sessions", tone: "faint", past: false });
  });
});

describe("byActivity", () => {
  it("orders upcoming, then recent, then inactive, keeping ties in input order", () => {
    const people = [
      { name: "never", activity: { kind: "inactive" as const, last: None } },
      { name: "old", activity: { kind: "inactive" as const, last: Some(at("2026-05-01T10:00")) } },
      { name: "recent", activity: { kind: "recent" as const, last: at("2026-08-20T10:00") } },
      { name: "later", activity: { kind: "upcoming" as const, next: at("2026-09-02T10:00") } },
      { name: "soon", activity: { kind: "upcoming" as const, next: at("2026-08-26T10:00") } },
      { name: "never2", activity: { kind: "inactive" as const, last: None } },
    ];
    expect(byActivity(people, (p) => p.activity).map((p) => p.name)).toEqual([
      "soon", "later", "recent", "old", "never", "never2",
    ]);
  });
});
