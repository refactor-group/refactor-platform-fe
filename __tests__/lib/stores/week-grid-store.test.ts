import { beforeEach, describe, expect, it } from "vitest";
import { None, Some } from "@/types/option";
import { createWeekGridStore } from "@/lib/stores/week-grid-store";

beforeEach(() => sessionStorage.clear());

describe("week grid store", () => {
  it("starts on the current week with no filter", () => {
    const state = createWeekGridStore().getState();
    expect(state.weekOffset).toBe(0);
    expect(state.personFilter).toEqual(None);
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

  it("sets and clears the person filter", () => {
    const store = createWeekGridStore();
    store.getState().setPersonFilter("u-alex");
    expect(store.getState().personFilter).toEqual(Some("u-alex"));
    store.getState().clearPersonFilter();
    expect(store.getState().personFilter).toEqual(None);
  });

  it("resets everything on logout", () => {
    const store = createWeekGridStore();
    store.getState().nextWeek();
    store.getState().setPersonFilter("u-alex");
    store.getState().resetWeekGrid();
    expect(store.getState().weekOffset).toBe(0);
    expect(store.getState().personFilter).toEqual(None);
  });

  it("keeps only the filter across reloads in this tab", () => {
    const first = createWeekGridStore();
    first.getState().setPersonFilter("u-alex");
    first.getState().nextWeek();
    const second = createWeekGridStore();
    expect(second.getState().personFilter).toEqual(Some("u-alex"));
    expect(second.getState().weekOffset).toBe(0);
  });

  it("selects an agenda day, and paging forgets it", () => {
    const store = createWeekGridStore();
    store.getState().selectDay("2026-08-21");
    expect(store.getState().selectedDay).toEqual(Some("2026-08-21"));
    store.getState().nextWeek();
    expect(store.getState().selectedDay).toEqual(None);
    store.getState().selectDay("2026-08-26");
    store.getState().previousWeek();
    expect(store.getState().selectedDay).toEqual(None);
    store.getState().selectDay("2026-08-21");
    store.getState().thisWeek();
    expect(store.getState().selectedDay).toEqual(None);
  });

  it("clears the agenda day on logout and never stores it", () => {
    const store = createWeekGridStore();
    store.getState().selectDay("2026-08-21");
    expect(createWeekGridStore().getState().selectedDay).toEqual(None);
    store.getState().resetWeekGrid();
    expect(store.getState().selectedDay).toEqual(None);
  });

  it("remembers moved sessions until cleared, and never stores them", () => {
    const store = createWeekGridStore();
    store.getState().markMoved("s-1");
    store.getState().markMoved("s-2");
    store.getState().markMoved("s-1");
    expect(store.getState().recentlyMoved).toEqual(["s-1", "s-2"]);
    expect(createWeekGridStore().getState().recentlyMoved).toEqual([]);
    store.getState().clearMoved();
    expect(store.getState().recentlyMoved).toEqual([]);
    store.getState().markMoved("s-3");
    store.getState().resetWeekGrid();
    expect(store.getState().recentlyMoved).toEqual([]);
  });

  it("forgets one moved session when its move is undone", () => {
    const store = createWeekGridStore();
    store.getState().markMoved("s-1");
    store.getState().markMoved("s-2");
    store.getState().unmarkMoved("s-1");
    expect(store.getState().recentlyMoved).toEqual(["s-2"]);
  });

  it("gives each store its own week", () => {
    const a = createWeekGridStore();
    const b = createWeekGridStore();
    a.getState().nextWeek();
    expect(b.getState().weekOffset).toBe(0);
  });
});
