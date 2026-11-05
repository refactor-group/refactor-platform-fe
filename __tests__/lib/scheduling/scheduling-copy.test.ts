import { describe, expect, it } from "vitest";
import {
  busyHeader,
  busyRange,
  createsLine,
  currentlyLine,
  meetingLine,
  moveSubmitLabel,
  moveTitle,
  nothingElseLine,
  overlapLine,
  repeatLabel,
  resolveSubline,
  scheduleSubmitLabel,
  insteadLabel,
  usualSlotLabel,
  whoSubline,
} from "@/lib/scheduling-copy";
import { Frequency } from "@/types/recurrence";
import { Provider } from "@/types/provider";
import { None, Some } from "@/types/option";
import { EHAB, NOW, TUESDAY, at, busy } from "./fixtures";

describe("usualSlotLabel", () => {
  it("names the weekday in the plural and the time", () => {
    expect(usualSlotLabel({ weekday: 2, minute: 870 })).toBe("Usually Tuesdays, 2:30 PM");
    expect(usualSlotLabel({ weekday: 5, minute: 540 })).toBe("Usually Fridays, 9:00 AM");
  });
});

describe("whoSubline", () => {
  it("shows the usual slot first", () => {
    const usual = Some({ weekday: 2, minute: 870 });
    expect(whoSubline({ usual, next: None, last: Some(at("2026-08-11T14:30")) }, NOW)).toBe(
      "Usually Tuesdays, 2:30 PM"
    );
  });

  it("names a first session by weekday within the week", () => {
    expect(whoSubline({ usual: None, next: Some(at("2026-08-20T10:00")), last: None }, NOW)).toBe(
      "First session Thursday"
    );
  });

  it("names a later first session by date", () => {
    expect(whoSubline({ usual: None, next: Some(at("2026-09-03T10:00")), last: None }, NOW)).toBe(
      "First session Sep 3"
    );
  });

  it("falls back to the last session", () => {
    const line = whoSubline({ usual: None, next: Some(at("2026-08-20T10:00")), last: Some(at("2026-06-12T10:00")) }, NOW);
    expect(line).toBe("Last session Jun 12");
  });

  it("says when there are no sessions", () => {
    expect(whoSubline({ usual: None, next: None, last: None }, NOW)).toBe("No sessions yet");
  });
});

describe("When step lines", () => {
  it("heads the busy list with the long date", () => {
    expect(busyHeader(TUESDAY)).toBe("Already on Tuesday, August 18");
    expect(nothingElseLine(TUESDAY)).toBe("Nothing else on Tuesday, August 18.");
  });

  it("shows a busy range with both meridiems", () => {
    expect(busyRange(EHAB)).toBe("2:30 PM–3:20 PM");
  });

  it("names the clash by first name with a compact range", () => {
    expect(overlapLine(EHAB)).toBe("Overlaps with Ehab, 2:30–3:20 PM");
  });

  it("keeps both meridiems when the clash crosses noon", () => {
    const noon = busy("s-noon", "Sarah Kim", "2026-08-18T11:30", "2026-08-18T12:20");
    expect(overlapLine(noon)).toBe("Overlaps with Sarah, 11:30 AM–12:20 PM");
  });

  it("offers the free time", () => {
    expect(insteadLabel(at("2026-08-18T15:30"))).toBe("Use 3:30 PM instead");
  });
});

describe("Repeat labels", () => {
  it("describes each choice", () => {
    expect(repeatLabel({ kind: "none" })).toBe("Doesn't repeat");
    expect(repeatLabel({ kind: "repeat", frequency: Frequency.Weekly, interval: 1, end: { kind: "count", count: 8 } })).toBe(
      "Weekly, for 8 sessions"
    );
    expect(repeatLabel({ kind: "repeat", frequency: Frequency.Biweekly, interval: 1, end: { kind: "until", until: "2026-12-15" } })).toBe(
      "Every 2 weeks, until Dec 15"
    );
    expect(repeatLabel({ kind: "repeat", frequency: Frequency.Monthly, interval: 1, end: { kind: "count", count: 1 } })).toBe(
      "Monthly, for 1 session"
    );
  });
});

describe("submit labels", () => {
  it("counts what scheduling creates", () => {
    expect(scheduleSubmitLabel({ kind: "none" })).toBe("Schedule session");
    expect(scheduleSubmitLabel({ kind: "repeat", frequency: Frequency.Weekly, interval: 1, end: { kind: "count", count: 8 } })).toBe(
      "Schedule 8 sessions"
    );
    expect(scheduleSubmitLabel({ kind: "repeat", frequency: Frequency.Weekly, interval: 1, end: { kind: "until", until: "2026-12-15" } })).toBe(
      "Schedule series"
    );
  });

  it("titles a move by its scope", () => {
    expect(moveTitle(false)).toBe("Reschedule session");
    expect(moveTitle(true)).toBe("Reschedule series");
  });

  it("names the move scope", () => {
    expect(moveSubmitLabel(false)).toBe("Reschedule session");
    expect(moveSubmitLabel(true)).toBe("Reschedule this and following");
  });
});

describe("rail and resolve lines", () => {
  it("summarizes what scheduling creates", () => {
    expect(createsLine(1, "Ehab")).toBe("1 session with Ehab");
    expect(createsLine(8, "Ehab")).toBe("8 sessions with Ehab");
  });

  it("names the meeting link by provider, or nothing", () => {
    expect(meetingLine(Some(Provider.Google))).toEqual(Some("Google Meet link included"));
    expect(meetingLine(Some(Provider.Zoom))).toEqual(Some("Zoom link included"));
    expect(meetingLine(None)).toEqual(None);
  });

  it("says where the moved session is now", () => {
    expect(currentlyLine(at("2026-08-18T14:30"))).toBe("Currently Tue, Aug 18, 2:30 PM");
  });

  it("explains which session has to move", () => {
    expect(resolveSubline(EHAB)).toBe("Ehab's session on Tue 18 at 2:30 PM overlaps the new one. Move it to:");
  });
});
