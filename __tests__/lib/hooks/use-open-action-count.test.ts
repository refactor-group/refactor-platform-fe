import { describe, it, expect } from "vitest";
import { ItemStatus } from "@/types/general";
import { countOpenActions } from "@/lib/hooks/use-open-action-count";
import { createMockAction } from "../../test-utils";

describe("countOpenActions", () => {
  it("counts only not started, in progress and on hold actions", () => {
    const actions = [
      ItemStatus.NotStarted,
      ItemStatus.InProgress,
      ItemStatus.OnHold,
      ItemStatus.Completed,
      ItemStatus.WontDo,
      ItemStatus.InProgress,
    ].map((status, i) => createMockAction({ id: `action-${i}`, status }));

    expect(countOpenActions(actions)).toBe(4);
  });

  it("is 0 with no actions", () => {
    expect(countOpenActions([])).toBe(0);
  });
});
