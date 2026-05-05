import { describe, it, expect, beforeEach } from "vitest";
import { createCoachingSessionsCardFilterStore } from "@/lib/stores/coaching-sessions-card-filter-store";
import { SessionTimeWindow } from "@/components/ui/dashboard/coaching-sessions-filters";

describe("CoachingSessionsCardFilterStore", () => {
  let store: ReturnType<typeof createCoachingSessionsCardFilterStore>;

  beforeEach(() => {
    store = createCoachingSessionsCardFilterStore();
  });

  it("initializes with the default time range (Week) and no relationship filter", () => {
    // Week (a 7-day span centered on now) is the default — picked to match the weekly coaching
    // cadence so common cases (a session a couple days out) are visible
    // without the user having to discover the Filters popover.
    expect(store.getState().timeWindow).toBe(SessionTimeWindow.Week);
    expect(store.getState().relationshipFilter).toBeUndefined();
  });

  it("sets and retrieves the time range", () => {
    store.getState().setTimeWindow(SessionTimeWindow.Day);
    expect(store.getState().timeWindow).toBe(SessionTimeWindow.Day);
  });

  it("sets and retrieves the relationship filter", () => {
    store.getState().setRelationshipFilter("rel-456");
    expect(store.getState().relationshipFilter).toBe("rel-456");
  });

  // The actual logout-clearing contract: `useLogoutUser` calls this reset
  // so a different user logging in on the same tab doesn't inherit the
  // previous user's filter selection. If the defaults below ever drift
  // (e.g. a new field is added to the state but forgotten in
  // `defaultInitState`), this test catches it before it ships.
  it("resets time range and relationship filter to defaults — the contract useLogoutUser depends on", () => {
    store.getState().setTimeWindow(SessionTimeWindow.Quarter);
    store.getState().setRelationshipFilter("rel-456");
    expect(store.getState().timeWindow).toBe(SessionTimeWindow.Quarter);
    expect(store.getState().relationshipFilter).toBe("rel-456");

    store.getState().resetCoachingSessionsCardFilters();

    expect(store.getState().timeWindow).toBe(SessionTimeWindow.Week);
    expect(store.getState().relationshipFilter).toBeUndefined();
  });
});
