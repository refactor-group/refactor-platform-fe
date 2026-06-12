// Phase 3b — drag-reorder WIRING test (non-frozen, has teeth).
//
// The frozen `topic-reorder.test.ts` pins the pure `reorderTopicIds` helper.
// This test proves the *component* wires that helper to its `onReorder` prop:
// it drives the real `DndContext.onDragEnd` handler with a synthetic
// {active, over} and asserts `onReorder` is called with the FULL reordered id
// list — the exact whole-list payload the Phase 1 `reorder(orderedIds)` hook
// sends. It fails if a partial/wrong order (or only the moved id) is sent.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";
import { defaultCoachingSessionTopic } from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { TopicSectionContent } from "@/components/ui/coaching-sessions/topic-section-content";

// Capture DndContext's onDragEnd so the test can drive the real handler the
// component installs, without simulating jsdom pointer physics. Drag handles,
// overlay, sensors, and collision detection are no-ops here — the contract
// under test is the data computed at drag-end, not dnd-kit's own behaviour.
let capturedOnDragEnd: ((e: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd?: (e: DragEndEvent) => void;
  }) => {
    capturedOnDragEnd = onDragEnd;
    return <div data-testid="dnd-context">{children}</div>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    isDragging: false,
  }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false, active: null }),
  useSensor: () => ({}),
  useSensors: () => [],
  PointerSensor: class {},
  KeyboardSensor: class {},
  closestCenter: () => [],
}));

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
});

const noop = () => {};

const topics = [
  topic({ id: "a", user_id: "me", body: "First" }),
  topic({ id: "b", user_id: "them", body: "Second" }),
  topic({ id: "c", user_id: "me", body: "Third" }),
];

const dragEnd = (activeId: string, overId: string): DragEndEvent =>
  ({ active: { id: activeId }, over: { id: overId } } as unknown as DragEndEvent);

describe("TopicSectionContent — drag-reorder wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDragEnd = undefined;
  });

  it("calls onReorder with the FULL reordered id list when an item is dropped on another", () => {
    const onReorder = vi.fn();
    render(
      <TopicSectionContent
        topics={topics}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={noop}
        onReorder={onReorder}
      />
    );

    expect(capturedOnDragEnd).toBeTypeOf("function");
    capturedOnDragEnd!(dragEnd("a", "c"));

    expect(onReorder).toHaveBeenCalledTimes(1);
    // Whole-list payload: moving "a" onto "c" yields the full reordered list.
    expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"]);
  });

  it("sends the full list (not just the moved id) when moving up", () => {
    const onReorder = vi.fn();
    render(
      <TopicSectionContent
        topics={topics}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={noop}
        onReorder={onReorder}
      />
    );

    capturedOnDragEnd!(dragEnd("c", "a"));

    expect(onReorder).toHaveBeenCalledTimes(1);
    const payload = onReorder.mock.calls[0][0] as string[];
    expect(payload).toEqual(["c", "a", "b"]);
    // Teeth: a partial/single-id payload would not be the whole membership.
    expect(payload).toHaveLength(3);
    expect([...payload].sort()).toEqual(["a", "b", "c"]);
  });

  it("does not call onReorder when dropped onto itself", () => {
    const onReorder = vi.fn();
    render(
      <TopicSectionContent
        topics={topics}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={noop}
        onReorder={onReorder}
      />
    );

    capturedOnDragEnd!(dragEnd("b", "b"));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("does not call onReorder when there is no drop target", () => {
    const onReorder = vi.fn();
    render(
      <TopicSectionContent
        topics={topics}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={noop}
        onReorder={onReorder}
      />
    );

    capturedOnDragEnd!({ active: { id: "a" }, over: null } as unknown as DragEndEvent);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("does not mount a DndContext (no drag handles / reorder) when readOnly", () => {
    const onReorder = vi.fn();
    render(
      <TopicSectionContent
        topics={topics}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={noop}
        onReorder={onReorder}
        readOnly
      />
    );

    expect(screen.queryByTestId("dnd-context")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reorder topic/i })
    ).not.toBeInTheDocument();
  });
});
