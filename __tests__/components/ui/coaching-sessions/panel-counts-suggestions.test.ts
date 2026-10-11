import { describe, it, expect } from "vitest";
import { computePanelCounts } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { createMockAction } from "../../../test-utils";

describe("computePanelCounts with pending suggestions", () => {
  const actions = [createMockAction({ id: "a-1" }), createMockAction({ id: "a-2" })];

  it("adds pending suggestions to the Actions total", () => {
    const counts = computePanelCounts([], [], [actions[0]], [actions[1]], [], 3);
    expect(counts[PanelSection.Actions]).toBe("5");
  });

  it("shows suggestions alone when there are no actions yet", () => {
    expect(computePanelCounts([], [], [], [], [], 2)[PanelSection.Actions]).toBe("2");
  });

  it("is empty with no actions and no suggestions", () => {
    expect(computePanelCounts([], [], [], [], [], 0)[PanelSection.Actions]).toBe("");
    expect(computePanelCounts([], [], [], [], [])[PanelSection.Actions]).toBe("");
  });
});
