import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKING_HOURS,
  StepKind,
  busyOn,
  currentStep,
  freeSlots,
  nextFreeStart,
  nextStep,
  overlapping,
  prevStep,
  stepOrder,
  stepPosition,
  suggestTimes,
  usualSlot,
} from "@/lib/scheduling";
import { None, Some } from "@/types/option";
import { ALEX_WED, EHAB, NOW, PRIYA, TUESDAY, at, busy, hhmm } from "./fixtures";

const times = (...isos: string[]) => isos.map(at);

describe("busyOn", () => {
  const all = [PRIYA, ALEX_WED, EHAB];

  it("keeps the sessions that start on the day, sorted by start", () => {
    expect(busyOn(all, TUESDAY, None)).toEqual([EHAB, PRIYA]);
  });

  it("leaves out the excluded session", () => {
    expect(busyOn(all, TUESDAY, Some(EHAB.id))).toEqual([PRIYA]);
  });

  it("returns nothing for a free day", () => {
    expect(busyOn(all, at("2026-08-20T00:00"), None)).toEqual([]);
  });

  it("uses the local day, not the UTC day", () => {
    const late = busy("s-late", "Sarah Kim", "2026-08-18T23:30", "2026-08-19T00:20");
    expect(busyOn([late], TUESDAY, None)).toEqual([late]);
    expect(busyOn([late], at("2026-08-19T00:00"), None)).toEqual([]);
  });

  it("accepts any time on the day", () => {
    expect(busyOn(all, at("2026-08-18T21:45"), None)).toEqual([EHAB, PRIYA]);
  });
});

describe("overlapping", () => {
  it("finds the session a slot runs into", () => {
    expect(overlapping({ start: at("2026-08-18T14:00"), minutes: 50 }, [EHAB, PRIYA])).toEqual([EHAB]);
  });

  it("treats touching edges as free", () => {
    expect(overlapping({ start: at("2026-08-18T13:40"), minutes: 50 }, [EHAB, PRIYA])).toEqual([]);
    expect(overlapping({ start: at("2026-08-18T15:20"), minutes: 50 }, [EHAB, PRIYA])).toEqual([]);
  });

  it("returns every clash, sorted by start", () => {
    expect(overlapping({ start: at("2026-08-18T15:00"), minutes: 120 }, [PRIYA, EHAB])).toEqual([EHAB, PRIYA]);
  });
});

describe("nextFreeStart", () => {
  it("steps forward 30 minutes at a time to the first free start", () => {
    const next = nextFreeStart({ start: at("2026-08-18T14:30"), minutes: 50 }, [EHAB, PRIYA], DEFAULT_WORKING_HOURS);
    expect(next.some && next.val.toFormat("HH:mm")).toBe("15:30");
  });

  it("gives up when nothing free ends inside working hours", () => {
    const next = nextFreeStart({ start: at("2026-08-18T16:00"), minutes: 50 }, [EHAB, PRIYA], DEFAULT_WORKING_HOURS);
    expect(next).toEqual(None);
  });
});

describe("freeSlots", () => {
  it("lists free half-hour starts that end inside working hours", () => {
    const hours = { start: 14 * 60, end: 16 * 60 + 30 };
    expect(hhmm(freeSlots(TUESDAY, [EHAB, PRIYA], 30, hours, NOW))).toEqual(["14:00", "15:30", "16:00"]);
  });

  it("drops starts before now", () => {
    const hours = { start: 9 * 60, end: 12 * 60 };
    expect(hhmm(freeSlots(TUESDAY, [], 50, hours, at("2026-08-18T09:45")))).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("returns slots on the day, in its zone", () => {
    const [first] = freeSlots(TUESDAY, [], 50, DEFAULT_WORKING_HOURS, NOW);
    expect(first.zoneName).toBe(TUESDAY.zoneName);
    expect(first.toISODate()).toBe("2026-08-18");
  });
});

describe("usualSlot", () => {
  it("takes the series start when there is one", () => {
    expect(usualSlot(Some(at("2026-06-23T14:30")), [])).toEqual(Some({ weekday: 2, minute: 870 }));
  });

  it("prefers the series over history", () => {
    const history = times("2026-07-02T09:00", "2026-07-09T09:00", "2026-07-16T09:00");
    expect(usualSlot(Some(at("2026-06-23T14:30")), history)).toEqual(Some({ weekday: 2, minute: 870 }));
  });

  it("falls back to the most common weekday and time in history", () => {
    const history = times("2026-06-02T14:30", "2026-06-09T14:30", "2026-07-02T09:00");
    expect(usualSlot(None, history)).toEqual(Some({ weekday: 2, minute: 870 }));
  });

  it("needs a weekday and time to repeat before calling it usual", () => {
    expect(usualSlot(None, times("2026-06-02T14:30", "2026-07-02T09:00"))).toEqual(None);
    expect(usualSlot(None, [])).toEqual(None);
  });

  it("breaks a tie by the most recent session", () => {
    const history = times("2026-06-02T14:30", "2026-06-09T14:30", "2026-07-02T09:00", "2026-07-09T09:00");
    expect(usualSlot(None, history)).toEqual(Some({ weekday: 4, minute: 540 }));
  });
});

describe("suggestTimes", () => {
  const base = {
    day: TUESDAY,
    minutes: 50,
    usual: None,
    coachStarts: [],
    busy: [EHAB, PRIYA],
    hours: DEFAULT_WORKING_HOURS,
    now: NOW,
  };

  it("ranks usual, then the coach's frequent starts, then round hours, keeping only free ones", () => {
    const coachStarts = times(
      "2026-07-01T09:00", "2026-07-08T09:00", "2026-07-15T09:00",
      "2026-07-02T10:00", "2026-07-09T10:00",
      "2026-07-03T16:30", "2026-07-10T16:30",
      "2026-07-06T11:00"
    );
    const result = suggestTimes({ ...base, usual: Some({ weekday: 2, minute: 870 }), coachStarts });
    expect(hhmm(result)).toEqual(["09:00", "10:00", "11:00", "12:00", "13:00"]);
  });

  it("keeps a free usual slot ahead of the cap, then sorts by time", () => {
    const result = suggestTimes({ ...base, usual: Some({ weekday: 2, minute: 930 }) });
    expect(hhmm(result)).toEqual(["09:00", "10:00", "11:00", "12:00", "15:30"]);
  });

  it("puts frequent coach starts ahead of round hours", () => {
    const coachStarts = times("2026-07-01T15:30", "2026-07-08T15:30");
    const result = suggestTimes({ ...base, coachStarts });
    expect(hhmm(result)).toEqual(["09:00", "10:00", "11:00", "12:00", "15:30"]);
  });

  it("uses the usual time of day whatever its weekday", () => {
    const result = suggestTimes({ ...base, usual: Some({ weekday: 4, minute: 930 }) });
    expect(hhmm(result)).toContain("15:30");
  });

  it("drops times already past today", () => {
    const result = suggestTimes({ ...base, now: at("2026-08-18T11:15") });
    expect(hhmm(result)).toEqual(["12:00", "13:00"]);
  });

  it("recomputes for a longer duration and may return fewer than five", () => {
    const result = suggestTimes({ ...base, minutes: 120 });
    expect(hhmm(result)).toEqual(["09:00", "10:00", "11:00", "12:00"]);
  });

  it("never returns more than five, deduplicated", () => {
    const coachStarts = times("2026-07-01T09:00", "2026-07-08T09:00", "2026-07-02T13:00");
    const result = suggestTimes({ ...base, busy: [], usual: Some({ weekday: 2, minute: 540 }), coachStarts });
    expect(result).toHaveLength(5);
    expect(new Set(hhmm(result)).size).toBe(5);
  });

  it("returns times on the chosen day, in its zone", () => {
    const [first] = suggestTimes(base);
    expect(first.toISODate()).toBe("2026-08-18");
    expect(first.zoneName).toBe(TUESDAY.zoneName);
  });
});

describe("step order", () => {
  it("schedules through Who, When and Repeat, adding Resolve on a clash", () => {
    expect(stepOrder({ kind: "schedule" }, false)).toEqual([StepKind.Who, StepKind.When, StepKind.Repeat]);
    expect(stepOrder({ kind: "schedule" }, true)).toEqual([
      StepKind.Who,
      StepKind.When,
      StepKind.Repeat,
      StepKind.Resolve,
    ]);
  });

  it("moves through When, with Applies to only when offered", () => {
    expect(stepOrder({ kind: "move", appliesTo: false }, false)).toEqual([StepKind.When]);
    expect(stepOrder({ kind: "move", appliesTo: true }, true)).toEqual([
      StepKind.When,
      StepKind.AppliesTo,
      StepKind.Resolve,
    ]);
  });

  it("falls back to the last step when the current one drops out", () => {
    const order = stepOrder({ kind: "schedule" }, false);
    expect(currentStep(order, StepKind.Resolve)).toBe(StepKind.Repeat);
    expect(currentStep(order, StepKind.When)).toBe(StepKind.When);
  });

  it("reports a 1-based position", () => {
    const order = stepOrder({ kind: "schedule" }, true);
    expect(stepPosition(order, StepKind.When)).toEqual({ index: 2, total: 4 });
  });

  it("has no previous step on the first and no next step on the last", () => {
    const order = stepOrder({ kind: "schedule" }, false);
    expect(prevStep(order, StepKind.Who)).toEqual(None);
    expect(nextStep(order, StepKind.Who)).toEqual(Some(StepKind.When));
    expect(nextStep(order, StepKind.Repeat)).toEqual(None);
    expect(prevStep(order, StepKind.Repeat)).toEqual(Some(StepKind.When));
  });
});
