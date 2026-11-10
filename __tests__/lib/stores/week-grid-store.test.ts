import { describe, expect, it } from "vitest";
import { createWeekGridStore } from "@/lib/stores/week-grid-store";

describe("week grid store", () => {
  it("starts on the current week", () => {
    expect(createWeekGridStore().getState().weekOffset).toBe(0);
  });

  it("pages a week at a time and returns to this week", () => {
    const store = createWeekGridStore();
    const { nextWeek, previousWeek, thisWeek } = store.getState();
    nextWeek();
    nextWeek();
    expect(store.getState().weekOffset).toBe(2);
    previousWeek();
    previousWeek();
    previousWeek();
    expect(store.getState().weekOffset).toBe(-1);
    thisWeek();
    expect(store.getState().weekOffset).toBe(0);
  });

  it("gives each store its own state", () => {
    const a = createWeekGridStore();
    const b = createWeekGridStore();
    a.getState().nextWeek();
    expect(b.getState().weekOffset).toBe(0);
  });
});
