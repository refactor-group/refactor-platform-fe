// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the Phase 3b contract for Topics drag-reorder: the pure order
// computation. Order is conveyed by ARRAY POSITION and reorder is a WHOLE-LIST
// operation — `reorderTopicIds` returns the full reordered id list (the exact
// payload the Phase 1 `reorder(orderedIds)` hook sends to the backend). The
// drag interaction itself (DndContext/useDraggable/useDroppable/DragOverlay) is
// wired by the component and covered by a separate non-frozen test that drives
// the onDragEnd handler.
//
// Read-only (chmod 0444), on the freeze list: an IMPLEMENTER must NOT edit it.
// Only the overseer may unlock it for a genuine spec/harness error.

import { describe, it, expect } from "vitest";
import { reorderTopicIds } from "@/components/ui/coaching-sessions/topic-section-content";

describe("reorderTopicIds — whole-list reorder by drag (active dropped onto over)", () => {
  it("moves an item down to the dropped position", () => {
    expect(reorderTopicIds(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("moves an item up to the dropped position", () => {
    expect(reorderTopicIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("moves a middle item to a later position", () => {
    expect(reorderTopicIds(["a", "b", "c", "d"], "b", "d")).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
  });

  it("is a no-op when active and over are the same", () => {
    expect(reorderTopicIds(["a", "b", "c"], "b", "b")).toEqual(["a", "b", "c"]);
  });

  it("is a no-op when an id is not in the list", () => {
    expect(reorderTopicIds(["a", "b", "c"], "x", "a")).toEqual(["a", "b", "c"]);
    expect(reorderTopicIds(["a", "b", "c"], "a", "x")).toEqual(["a", "b", "c"]);
  });

  it("returns the full list (same length and membership), not a partial payload", () => {
    const result = reorderTopicIds(["a", "b", "c"], "a", "c");
    expect(result).toHaveLength(3);
    expect([...result].sort()).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    reorderTopicIds(input, "a", "c");
    expect(input).toEqual(["a", "b", "c"]);
  });
});
