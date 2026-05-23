import { describe, it, expect, beforeEach } from "vitest";
import { createCoachingSessionsCardFilterStore } from "@/lib/stores/coaching-sessions-card-filter-store";

describe("CoachingSessionsCardFilterStore", () => {
  let store: ReturnType<typeof createCoachingSessionsCardFilterStore>;

  beforeEach(() => {
    store = createCoachingSessionsCardFilterStore();
  });

  it("initializes with no relationship filter", () => {
    expect(store.getState().relationshipFilter).toBeUndefined();
  });

  it("sets and retrieves the relationship filter", () => {
    store.getState().setRelationshipFilter("rel-456");
    expect(store.getState().relationshipFilter).toBe("rel-456");
  });

  // The actual logout-clearing contract: `useLogoutUser` calls this reset
  // so a different user logging in on the same tab doesn't inherit the
  // previous user's filter selection.
  it("resets relationship filter to default — the contract useLogoutUser depends on", () => {
    store.getState().setRelationshipFilter("rel-456");
    expect(store.getState().relationshipFilter).toBe("rel-456");

    store.getState().resetCoachingSessionsCardFilters();

    expect(store.getState().relationshipFilter).toBeUndefined();
  });
});
