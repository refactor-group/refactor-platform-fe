import { describe, expect, it } from "vitest";
import { schedulablePeople } from "@/lib/people";
import {
  busySessions,
  clashFor,
  occurrenceCount,
  pickerPeople,
  prefillWhen,
  resolveDays,
  resolveSlots,
  scheduleHint,
  scheduleRail,
  seriesPayload,
  sessionPayload,
  usualFor,
} from "@/lib/schedule-draft";
import { DEFAULT_WORKING_HOURS, StepKind } from "@/lib/scheduling";
import { type Option, None, Some } from "@/types/option";
import { Provider } from "@/types/provider";
import { Frequency, Weekday } from "@/types/recurrence";
import { EHAB, PRIYA, at as fixtureAt } from "../../components/ui/new-session/fixtures";
import { ALL, E_18, ME, NEAREST, NOW, P_18, RELATIONSHIPS, ZONE, at, session } from "./roster";

const iso = (dt: Option<{ toISO: () => string | null }>) => (dt.some ? dt.val.toISO() : "none");
const times = (dts: { toFormat: (f: string) => string }[]) => dts.map((d) => d.toFormat("HH:mm"));
const people = () => schedulablePeople(ME, RELATIONSHIPS);

describe("schedulablePeople", () => {
  it("lists only the people I coach, by name", () => {
    expect(people().map((p) => p.person.fullName)).toEqual(["Dana Fox", "Ehab Badawi", "Priya Raman", "Sara Lin"]);
    expect(people().find((p) => p.person.fullName === "Ehab Badawi")?.relationshipIds).toEqual(["rel-e"]);
  });
});

describe("busySessions", () => {
  it("names the other person and places the session in my zone", () => {
    const [busy] = busySessions([E_18], ME, ZONE);
    expect(busy.id).toBe("e-18");
    expect(busy.personName).toBe("Ehab Badawi");
    expect(busy.start.toISO()).toBe(at("2026-08-18T14:30").toISO());
    expect(busy.end.toISO()).toBe(at("2026-08-18T15:20").toISO());
  });

  it("names my coach when I'm the coachee", () => {
    const mine = session({
      id: "b-19",
      relationshipId: "rel-b",
      person: { id: "boss", first: "Boss", last: "Person" },
      start: "2026-08-19T11:00",
      asCoachee: true,
    });
    expect(busySessions([mine], ME, ZONE)[0].personName).toBe("Boss Person");
  });
});

describe("usualFor", () => {
  it("takes an upcoming series session's weekday and time", () => {
    const usual = usualFor(["rel-e"], ALL, NOW, ZONE);
    expect(usual).toEqual(Some({ weekday: 2, minute: 14 * 60 + 30 }));
  });

  it("falls back to the most common past start", () => {
    expect(usualFor(["rel-s"], ALL, NOW, ZONE)).toEqual(Some({ weekday: 4, minute: 9 * 60 }));
  });

  it("is None without a series or a repeated time", () => {
    expect(usualFor(["rel-p"], ALL, NOW, ZONE)).toEqual(None);
    expect(usualFor(["rel-x"], ALL, NOW, ZONE)).toEqual(None);
  });
});

describe("pickerPeople", () => {
  it("orders by activity, with sub-lines and inactive people flagged", () => {
    const picked = pickerPeople({ people: people(), nearest: Some(NEAREST), history: ALL, now: NOW, timezone: ZONE });
    expect(picked.map((p) => [p.fullName, p.subline, p.inactive])).toEqual([
      ["Ehab Badawi", "Usually Tuesdays, 2:30 PM", false],
      ["Priya Raman", "Last session Aug 10", false],
      ["Sara Lin", "Usually Thursdays, 9:00 AM", false],
      ["Dana Fox", "Last session Jun 1", true],
    ]);
    expect(picked[0]).toMatchObject({ userId: "ehab", initials: "EB" });
  });

  it("says when a first session is coming up, or that there are none", () => {
    const first = session({
      id: "n-20",
      relationshipId: "rel-d",
      person: { id: "dana", first: "Dana", last: "Fox" },
      start: "2026-08-20T10:00",
    });
    const picked = pickerPeople({ people: people(), nearest: Some([first]), history: [first], now: NOW, timezone: ZONE });
    const sublines = Object.fromEntries(picked.map((p) => [p.fullName, p.subline]));
    expect(sublines["Dana Fox"]).toBe("First session Thursday");
    expect(sublines["Sara Lin"]).toBe("No sessions yet");
  });

  it("keeps name order and hides no one until activity loads", () => {
    const picked = pickerPeople({ people: people(), nearest: None, history: [], now: NOW, timezone: ZONE });
    expect(picked.map((p) => p.fullName)).toEqual(["Dana Fox", "Ehab Badawi", "Priya Raman", "Sara Lin"]);
    expect(picked.every((p) => !p.inactive)).toBe(true);
  });
});

describe("prefillWhen", () => {
  const thursday9 = Some({ weekday: 4, minute: 9 * 60 });

  it("uses the next date on the usual weekday, at the usual time", () => {
    const when = prefillWhen({ requested: None, usual: thursday9, busy: [], minutes: 50, now: NOW });
    expect(when.day.some && when.day.val.toISODate()).toBe("2026-08-20");
    expect(when.time).toEqual(Some("09:00"));
  });

  it("skips today when the usual time has passed, keeps it when it hasn't", () => {
    const monday = (minute: number) =>
      prefillWhen({ requested: None, usual: Some({ weekday: 1, minute }), busy: [], minutes: 50, now: NOW });
    const passed = monday(9 * 60);
    expect(passed.day.some && passed.day.val.toISODate()).toBe("2026-08-24");
    const ahead = monday(11 * 60);
    expect(ahead.day.some && ahead.day.val.toISODate()).toBe("2026-08-17");
    expect(ahead.time).toEqual(Some("11:00"));
  });

  it("leaves the time empty when the usual slot is taken", () => {
    const busy = busySessions([P_18], ME, ZONE);
    const when = prefillWhen({
      requested: None,
      usual: Some({ weekday: 2, minute: 16 * 60 + 30 }),
      busy,
      minutes: 50,
      now: NOW,
    });
    expect(when.day.some && when.day.val.toISODate()).toBe("2026-08-18");
    expect(when.time).toEqual(None);
  });

  it("keeps a requested date and still offers the usual time when free", () => {
    const when = prefillWhen({
      requested: Some(at("2026-08-19T00:00")),
      usual: Some({ weekday: 2, minute: 14 * 60 + 30 }),
      busy: busySessions(ALL, ME, ZONE),
      minutes: 50,
      now: NOW,
    });
    expect(when.day.some && when.day.val.toISODate()).toBe("2026-08-19");
    expect(when.time).toEqual(Some("14:30"));
  });

  it("prefills nothing without a request or a usual slot", () => {
    expect(prefillWhen({ requested: None, usual: None, busy: [], minutes: 50, now: NOW })).toEqual({
      day: None,
      time: None,
    });
  });
});

describe("clashFor", () => {
  const busy = [EHAB, PRIYA];

  it("returns the first overlapping session and the next free start", () => {
    const clash = clashFor({ start: fixtureAt("2026-08-18T14:30"), minutes: 50 }, busy, DEFAULT_WORKING_HOURS);
    expect(clash.some && clash.val.session.id).toBe("s-ehab");
    expect(clash.some && iso(clash.val.instead)).toBe(fixtureAt("2026-08-18T15:30").toISO());
  });

  it("is None for a free slot", () => {
    expect(clashFor({ start: fixtureAt("2026-08-18T15:30"), minutes: 50 }, busy, DEFAULT_WORKING_HOURS)).toEqual(None);
  });

  it("offers no instead when nothing is free before the day ends", () => {
    const clash = clashFor({ start: fixtureAt("2026-08-18T16:00"), minutes: 60 }, busy, DEFAULT_WORKING_HOURS);
    expect(clash.some && clash.val.session.id).toBe("s-priya");
    expect(clash.some && clash.val.instead).toEqual(None);
  });
});

describe("resolveDays", () => {
  it("is the clash's Monday-to-Sunday week, with past days marked", () => {
    const days = resolveDays(fixtureAt("2026-08-18T14:30"), fixtureAt("2026-08-19T08:00"));
    expect(days.map((d) => d.day.toISODate())).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
    expect(days.map((d) => d.past)).toEqual([true, true, false, false, false, false, false]);
  });
});

describe("resolveSlots", () => {
  const newSlot = { start: fixtureAt("2026-08-18T14:30"), minutes: 50 };

  it("lists free 30-minute starts for the other session, around the new one", () => {
    const slots = resolveSlots({
      day: fixtureAt("2026-08-18T00:00"),
      clash: EHAB,
      newSlot,
      busy: [EHAB, PRIYA],
      hours: DEFAULT_WORKING_HOURS,
      now: fixtureAt("2026-08-17T10:00"),
    });
    expect(times(slots)).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "15:30",
    ]);
  });

  it("fills a free day inside working hours", () => {
    const slots = resolveSlots({
      day: fixtureAt("2026-08-19T00:00"),
      clash: EHAB,
      newSlot,
      busy: [EHAB, PRIYA],
      hours: DEFAULT_WORKING_HOURS,
      now: fixtureAt("2026-08-17T10:00"),
    });
    expect(slots).toHaveLength(15);
    expect(times(slots).slice(-1)).toEqual(["16:00"]);
  });
});

describe("occurrenceCount", () => {
  const start = at("2026-08-20T09:00");

  it("is the count when the series ends after a number of sessions", () => {
    expect(
      occurrenceCount({ start, frequency: Frequency.Weekly, byWeekdays: [Weekday.Thu], end: { kind: "count", count: 8 } })
    ).toBe(8);
  });

  it("counts dates through an end date, inclusive", () => {
    const until = (date: string) => ({ kind: "until" as const, until: date });
    expect(occurrenceCount({ start, frequency: Frequency.Weekly, byWeekdays: [Weekday.Thu], end: until("2026-09-10") })).toBe(4);
    expect(
      occurrenceCount({ start, frequency: Frequency.Weekly, byWeekdays: [Weekday.Tue, Weekday.Thu], end: until("2026-09-01") })
    ).toBe(4);
    expect(occurrenceCount({ start, frequency: Frequency.Biweekly, byWeekdays: [Weekday.Thu], end: until("2026-09-17") })).toBe(3);
    expect(occurrenceCount({ start, frequency: Frequency.Monthly, byWeekdays: [], end: until("2026-12-15") })).toBe(4);
    expect(occurrenceCount({ start, frequency: Frequency.Weekly, byWeekdays: [Weekday.Thu], end: until("2026-08-19") })).toBe(0);
  });
});

describe("sessionPayload", () => {
  it("stores the start as naive UTC with the duration and provider", () => {
    const payload = sessionPayload({
      relationshipId: "rel-s",
      start: at("2026-08-20T09:00"),
      minutes: 50,
      provider: Some(Provider.Google),
    });
    expect(payload).toMatchObject({
      coaching_relationship_id: "rel-s",
      date: "2026-08-20T14:00:00",
      duration_minutes: 50,
      provider: Provider.Google,
    });
    const without = sessionPayload({ relationshipId: "rel-s", start: at("2026-08-20T09:00"), minutes: 50, provider: None });
    expect(without.provider).toBeUndefined();
  });
});

describe("seriesPayload", () => {
  const input = { relationshipId: "rel-s", start: at("2026-08-20T09:00"), minutes: 50, timezone: ZONE };

  it("builds a weekly series ending after a count", () => {
    expect(
      seriesPayload({ ...input, frequency: Frequency.Weekly, byWeekdays: [Weekday.Thu], end: { kind: "count", count: 8 } })
    ).toEqual({
      coaching_relationship_id: "rel-s",
      start_at: "2026-08-20T14:00:00",
      duration_minutes: 50,
      recurrence: { frequency: Frequency.Weekly, by_weekdays: [Weekday.Thu], count: 8 },
    });
  });

  it("sends an end date as the end of that day, and no weekdays for monthly", () => {
    const payload = seriesPayload({
      ...input,
      frequency: Frequency.Monthly,
      byWeekdays: [Weekday.Thu],
      end: { kind: "until", until: "2026-12-15" },
    });
    expect(payload.recurrence).toEqual({ frequency: Frequency.Monthly, until: "2026-12-16T05:59:59" });
  });
});

describe("scheduleRail", () => {
  const order = [StepKind.Who, StepKind.When, StepKind.Repeat];
  const withClash = [...order, StepKind.Resolve];
  const start = Some(fixtureAt("2026-08-18T14:30"));

  it("shows placeholders and the current step before anything is chosen", () => {
    expect(
      scheduleRail({
        order,
        step: StepKind.Who,
        personName: None,
        start: None,
        repeat: { kind: "none" },
        clash: None,
        resolution: { kind: "unresolved" },
      })
    ).toEqual([
      { id: "who", label: "Who", value: "Choose a person", done: false, current: true },
      { id: "when", label: "When", value: "Set a date and time", done: false, current: false },
      { id: "repeat", label: "Repeats", value: "Doesn't repeat", done: false, current: false },
    ]);
  });

  it("fills in choices and adds Resolve overlap for a clash", () => {
    const rail = scheduleRail({
      order: withClash,
      step: StepKind.When,
      personName: Some("Priya Raman"),
      start,
      repeat: { kind: "repeat", frequency: Frequency.Weekly, end: { kind: "count", count: 8 } },
      clash: Some(EHAB),
      resolution: { kind: "unresolved" },
    });
    expect(rail.map((r) => [r.value, r.done, r.current])).toEqual([
      ["Priya Raman", true, false],
      ["Tuesday, August 18, 2:30 PM", true, true],
      ["Weekly, for 8 sessions", true, false],
      ["Choose a new time for Ehab", false, false],
    ]);
    expect(rail[3]).toMatchObject({ id: "resolve", label: "Resolve overlap" });
  });

  it("marks Repeats done once passed, and names the resolution", () => {
    const input = {
      order: withClash,
      step: StepKind.Resolve,
      personName: Some("Priya Raman"),
      start,
      repeat: { kind: "none" as const },
      clash: Some(EHAB),
    };
    const moved = scheduleRail({ ...input, resolution: { kind: "move", start: fixtureAt("2026-08-18T15:30") } });
    expect(moved[2].done).toBe(true);
    expect(moved[3]).toMatchObject({ value: "Move Ehab to Tue 18, 3:30 PM", done: true, current: true });
    const kept = scheduleRail({ ...input, resolution: { kind: "keep" } });
    expect(kept[3]).toMatchObject({ value: "Keep both at 2:30 PM", done: true });
  });

  it("puts a step that dropped out of the order on the last step", () => {
    const rail = scheduleRail({
      order,
      step: StepKind.Resolve,
      personName: None,
      start: None,
      repeat: { kind: "none" },
      clash: None,
      resolution: { kind: "unresolved" },
    });
    expect(rail.map((r) => r.current)).toEqual([false, false, true]);
  });
});

describe("scheduleHint", () => {
  const ready = { personName: Some("Priya Raman"), start: Some(fixtureAt("2026-08-18T14:30")) };

  it("asks for what's missing", () => {
    const missing = "Choose a person, date and time to schedule.";
    expect(scheduleHint({ ...ready, personName: None, clash: None, resolution: { kind: "unresolved" } })).toEqual(Some(missing));
    expect(scheduleHint({ ...ready, start: None, clash: None, resolution: { kind: "unresolved" } })).toEqual(Some(missing));
  });

  it("asks to resolve an unresolved clash", () => {
    expect(scheduleHint({ ...ready, clash: Some(EHAB), resolution: { kind: "unresolved" } })).toEqual(
      Some("Pick a new time for Ehab, or keep both.")
    );
  });

  it("is None once everything is chosen", () => {
    expect(scheduleHint({ ...ready, clash: None, resolution: { kind: "unresolved" } })).toEqual(None);
    expect(scheduleHint({ ...ready, clash: Some(EHAB), resolution: { kind: "keep" } })).toEqual(None);
  });
});
