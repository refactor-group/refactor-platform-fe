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

  it("gives each store its own week", () => {
    const a = createWeekGridStore();
    const b = createWeekGridStore();
    a.getState().nextWeek();
    expect(b.getState().weekOffset).toBe(0);
  });
});
