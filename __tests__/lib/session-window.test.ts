import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import type { MenuSession } from "@/components/ui/join-session/types";
import {
  dotKind,
  listDate,
  livenessFromUrgency,
  monthGroups,
  sessionWindow,
  timeOfDay,
} from "@/lib/session-window";
import { None, Some } from "@/types/option";
import { SessionUrgency } from "@/types/session-display";

const ZONE = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });
const now = at("2026-08-25T12:00");

function s(id: string, isoStart: string): MenuSession {
  return { id, start: at(isoStart), title: `Title ${id}`, liveness: "none" };
}

const ids = (sessions: MenuSession[]) => sessions.map((x) => x.id);

const p5 = s("p5", "2026-07-21T10:00");
const p4 = s("p4", "2026-07-28T10:00");
const p3 = s("p3", "2026-08-04T10:00");
const p2 = s("p2", "2026-08-11T10:00");
const p1 = s("p1", "2026-08-18T10:00");
const T = s("T", "2026-08-25T14:30");
const f1 = s("f1", "2026-09-01T10:00");
const f2 = s("f2", "2026-09-08T10:00");
const f3 = s("f3", "2026-09-15T10:00");

describe("sessionWindow", () => {
  it("pivots on today's session", () => {
    const result = sessionWindow({
      sessions: [p3, p2, p1, T, f1, f2, f3],
      today: Some("T"),
      current: None,
      now,
    });
    expect(ids(result.list)).toEqual(["f2", "f1", "p1", "p2"]);
    expect(ids(result.dots)).toEqual(["p2", "p1", "T", "f1", "f2"]);
  });

  it("pivots on the current session when there is no today", () => {
    const result = sessionWindow({
      sessions: [f2, f1, p1, p2, p3, p4, p5],
      today: None,
      current: Some("p2"),
      now,
    });
    expect(ids(result.list)).toEqual(["f1", "p1", "p2", "p3", "p4"]);
  });

  it("splits around now when neither is set, regardless of input order", () => {
    const result = sessionWindow({
      sessions: [p2, f1, p3, f3, p1, f2],
      today: None,
      current: None,
      now,
    });
    expect(ids(result.list)).toEqual(["f2", "f1", "p1", "p2"]);
  });

  it("handles sparse and empty histories", () => {
    const one = sessionWindow({ sessions: [p1], today: None, current: None, now });
    expect(ids(one.list)).toEqual(["p1"]);
    const empty = sessionWindow({ sessions: [], today: None, current: None, now });
    expect(empty.list).toEqual([]);
    expect(empty.dots).toEqual([]);
  });

  it("never backfills a short side from the other", () => {
    const result = sessionWindow({
      sessions: [f1, f2, f3],
      today: None,
      current: None,
      now,
    });
    expect(ids(result.list)).toEqual(["f2", "f1"]);
  });

  it("falls through to the around-now rule when today's id is missing", () => {
    const result = sessionWindow({
      sessions: [f3, f2, f1, p1, p2, p3],
      today: Some("missing"),
      current: None,
      now,
    });
    expect(ids(result.list)).toEqual(["f2", "f1", "p1", "p2"]);
  });

  it("never lists more than 5 sessions for a long history", () => {
    const history: MenuSession[] = Array.from({ length: 20 }, (_, i) => ({
      id: `h${i}`,
      start: now.minus({ weeks: 10 }).plus({ weeks: i }),
      title: `Title h${i}`,
      liveness: "none",
    }));
    const cases = [
      { today: Some("h10"), current: None },
      { today: None, current: Some("h10") },
      { today: None, current: None },
    ];
    for (const c of cases) {
      expect(sessionWindow({ sessions: history, now, ...c }).list.length).toBeLessThanOrEqual(5);
    }
  });
});

describe("dotKind", () => {
  it("ranks current over today over upcoming/past", () => {
    expect(dotKind(T, { today: Some("T"), current: Some("T"), now })).toBe("current");
    expect(dotKind(T, { today: Some("T"), current: None, now })).toBe("today");
    expect(dotKind(f1, { today: None, current: None, now })).toBe("upcoming");
    expect(dotKind(p1, { today: None, current: None, now })).toBe("past");
  });

  it("treats a session exactly at now as upcoming", () => {
    expect(dotKind(s("n", "2026-08-25T12:00"), { today: None, current: None, now })).toBe(
      "upcoming"
    );
  });
});

describe("monthGroups", () => {
  it("groups by month and selects the anchor's month", () => {
    const groups = monthGroups([p2, p1, T, f1, f2], at("2026-08-25T14:30"));
    expect(groups.map((g) => g.label)).toEqual(["Aug", "Sep"]);
    expect(groups.map((g) => g.selected)).toEqual([true, false]);
    expect(ids(groups[0].sessions)).toEqual(["p2", "p1", "T"]);
    expect(ids(groups[1].sessions)).toEqual(["f1", "f2"]);
  });

  it("keeps years apart and requires the anchor's year to match", () => {
    const dec = s("d", "2026-12-15T10:00");
    const jan = s("j", "2027-01-12T10:00");
    const groups = monthGroups([dec, jan], at("2026-01-20T10:00"));
    expect(groups.map((g) => g.key)).toEqual(["2026-12", "2027-01"]);
    expect(groups.map((g) => g.selected)).toEqual([false, false]);
  });
});

describe("livenessFromUrgency", () => {
  it("maps urgency to liveness", () => {
    expect(livenessFromUrgency(SessionUrgency.Underway)).toBe("live");
    expect(livenessFromUrgency(SessionUrgency.Imminent)).toBe("soon");
    expect(livenessFromUrgency(SessionUrgency.Soon)).toBe("none");
    expect(livenessFromUrgency(SessionUrgency.Later)).toBe("none");
    expect(livenessFromUrgency(SessionUrgency.Past)).toBe("none");
  });
});

describe("formatters", () => {
  it("formats list dates and times of day", () => {
    expect(listDate(at("2026-09-01T10:00"))).toBe("Tue Sep 1");
    expect(timeOfDay(at("2026-08-25T14:30"))).toBe("2:30 PM");
  });
});
