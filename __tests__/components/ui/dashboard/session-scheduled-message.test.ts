import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { rescheduledMessage, scheduledMessage } from "@/components/ui/dashboard/session-change-message";
import { Frequency } from "@/types/recurrence";
import { None, Some } from "@/types/option";

const at = (iso: string) => DateTime.fromISO(iso, { zone: "America/Chicago" });

describe("scheduledMessage", () => {
  it("lists who, when and how long", () => {
    const message = scheduledMessage({
      personName: "Ehab Badawi",
      start: at("2026-08-18T14:30"),
      minutes: 50,
      repeat: { kind: "none" },
      otherMove: None,
    });
    expect(message).toBe("Scheduled · Ehab Badawi · Tuesday, August 18 · 2:30 PM · 50 min");
  });

  it("adds the repeat and the other session's move", () => {
    const message = scheduledMessage({
      personName: "Ehab Badawi",
      start: at("2026-08-18T14:30"),
      minutes: 50,
      repeat: { kind: "repeat", frequency: Frequency.Weekly, interval: 1, end: { kind: "count", count: 8 } },
      otherMove: Some({ personName: "Priya Raman", start: at("2026-08-19T15:30") }),
    });
    expect(message).toBe(
      "Scheduled · Ehab Badawi · Tuesday, August 18 · 2:30 PM · 50 min · Weekly, for 8 sessions · Priya moves to Wed 19, 3:30 PM"
    );
  });
});

describe("rescheduledMessage", () => {
  it("names the person and the new time", () => {
    const message = rescheduledMessage({
      personName: "Ehab Badawi",
      start: at("2026-08-20T14:00"),
      following: false,
      otherMove: None,
    });
    expect(message).toBe("Rescheduled · Ehab to Thursday, August 20, 2:00 PM");
  });

  it("marks a series move and the other session's move", () => {
    const message = rescheduledMessage({
      personName: "Ehab Badawi",
      start: at("2026-08-20T14:00"),
      following: true,
      otherMove: Some({ personName: "Alex Chen", start: at("2026-08-20T15:30") }),
    });
    expect(message).toBe("Rescheduled · Ehab to Thursday, August 20, 2:00 PM · and following · Alex moves to Thu 20, 3:30 PM");
  });
});
