import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import {
  StatusVisibility,
  TimeRange,
  TimeField,
} from "@/types/assigned-actions";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import {
  STATUS_COLUMN_ORDER,
  statusLabel,
  statusColor,
  groupByStatus,
  applyTimeFilter,
  filterByRelationship,
  visibleStatuses,
  buildInitialOrder,
  sortGroupedByInitialOrder,
} from "@/components/ui/actions/utils";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeAction(
  overrides: Partial<{
    id: string;
    status: ItemStatus;
    due_by: DateTime;
    created_at: DateTime;
    relationshipId: string;
  }> = {}
): AssignedActionWithContext {
  const now = DateTime.now();
  return {
    action: {
      id: overrides.id ?? "action-1",
      coaching_session_id: "session-1",
      body: "Test action",
      user_id: "user-1",
      status: overrides.status ?? ItemStatus.NotStarted,
      status_changed_at: now,
      due_by: overrides.due_by ?? now.plus({ days: 7 }),
      created_at: overrides.created_at ?? now,
      updated_at: now,
      assignee_ids: ["user-1"],
    },
    relationship: {
      coachingRelationshipId: overrides.relationshipId ?? "rel-1",
      coachId: "coach-1",
      coacheeId: "coachee-1",
      coachName: "Alice Smith",
      coacheeName: "Bob Jones",
    },
    goal: {
      overarchingGoalId: "goal-1",
      title: "Test Goal",
    },
    sourceSession: {
      coachingSessionId: "session-1",
      sessionDate: now,
    },
    nextSession: null,
    isOverdue: false,
  };
}

// ---------------------------------------------------------------------------
// statusLabel
// ---------------------------------------------------------------------------

describe("statusLabel", () => {
  it("returns correct label for each status", () => {
    expect(statusLabel(ItemStatus.NotStarted)).toBe("Not Started");
    expect(statusLabel(ItemStatus.InProgress)).toBe("In Progress");
    expect(statusLabel(ItemStatus.Completed)).toBe("Completed");
    expect(statusLabel(ItemStatus.WontDo)).toBe("Won't Do");
  });
});

// ---------------------------------------------------------------------------
// statusColor
// ---------------------------------------------------------------------------

describe("statusColor", () => {
  it("returns a Tailwind class for each status", () => {
    expect(statusColor(ItemStatus.NotStarted)).toBe("bg-slate-400");
    expect(statusColor(ItemStatus.InProgress)).toBe("bg-blue-500");
    expect(statusColor(ItemStatus.Completed)).toBe("bg-green-500");
    expect(statusColor(ItemStatus.WontDo)).toBe("bg-gray-400");
  });
});

// ---------------------------------------------------------------------------
// groupByStatus
// ---------------------------------------------------------------------------

describe("groupByStatus", () => {
  it("groups actions correctly across all 4 status buckets", () => {
    const actions = [
      makeAction({ id: "a1", status: ItemStatus.NotStarted }),
      makeAction({ id: "a2", status: ItemStatus.InProgress }),
      makeAction({ id: "a3", status: ItemStatus.Completed }),
      makeAction({ id: "a4", status: ItemStatus.WontDo }),
      makeAction({ id: "a5", status: ItemStatus.NotStarted }),
    ];

    const grouped = groupByStatus(actions);

    expect(grouped[ItemStatus.NotStarted]).toHaveLength(2);
    expect(grouped[ItemStatus.InProgress]).toHaveLength(1);
    expect(grouped[ItemStatus.Completed]).toHaveLength(1);
    expect(grouped[ItemStatus.WontDo]).toHaveLength(1);
  });

  it("returns empty arrays when all actions have the same status", () => {
    const actions = [
      makeAction({ id: "a1", status: ItemStatus.InProgress }),
      makeAction({ id: "a2", status: ItemStatus.InProgress }),
    ];

    const grouped = groupByStatus(actions);

    expect(grouped[ItemStatus.InProgress]).toHaveLength(2);
    expect(grouped[ItemStatus.NotStarted]).toHaveLength(0);
    expect(grouped[ItemStatus.Completed]).toHaveLength(0);
    expect(grouped[ItemStatus.WontDo]).toHaveLength(0);
  });

  it("returns all empty arrays for empty input", () => {
    const grouped = groupByStatus([]);

    for (const status of STATUS_COLUMN_ORDER) {
      expect(grouped[status]).toEqual([]);
    }
  });

  it("preserves action order within each bucket", () => {
    const actions = [
      makeAction({ id: "a1", status: ItemStatus.NotStarted }),
      makeAction({ id: "a2", status: ItemStatus.NotStarted }),
      makeAction({ id: "a3", status: ItemStatus.NotStarted }),
    ];

    const grouped = groupByStatus(actions);
    const ids = grouped[ItemStatus.NotStarted].map((a) => a.action.id);

    expect(ids).toEqual(["a1", "a2", "a3"]);
  });
});

// ---------------------------------------------------------------------------
// applyTimeFilter
// ---------------------------------------------------------------------------

describe("applyTimeFilter", () => {
  it("AllTime returns all actions unfiltered", () => {
    const actions = [
      makeAction({
        id: "old",
        due_by: DateTime.now().minus({ days: 200 }),
      }),
      makeAction({ id: "recent", due_by: DateTime.now() }),
    ];

    const result = applyTimeFilter(actions, TimeRange.AllTime, TimeField.DueDate);

    expect(result).toHaveLength(2);
  });

  it("Last30Days excludes actions older than 30 days", () => {
    const actions = [
      makeAction({
        id: "old",
        due_by: DateTime.now().minus({ days: 60 }),
      }),
      makeAction({
        id: "recent",
        due_by: DateTime.now().minus({ days: 5 }),
      }),
    ];

    const result = applyTimeFilter(actions, TimeRange.Last30Days, TimeField.DueDate);

    expect(result).toHaveLength(1);
    expect(result[0].action.id).toBe("recent");
  });

  it("Last90Days excludes actions older than 90 days", () => {
    const actions = [
      makeAction({
        id: "ancient",
        due_by: DateTime.now().minus({ days: 120 }),
      }),
      makeAction({
        id: "old",
        due_by: DateTime.now().minus({ days: 60 }),
      }),
      makeAction({
        id: "recent",
        due_by: DateTime.now().minus({ days: 10 }),
      }),
    ];

    const result = applyTimeFilter(actions, TimeRange.Last90Days, TimeField.DueDate);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.action.id)).toEqual(["old", "recent"]);
  });

  it("uses created_at when TimeField is CreatedDate", () => {
    const actions = [
      makeAction({
        id: "old-created",
        due_by: DateTime.now(), // recent due date
        created_at: DateTime.now().minus({ days: 60 }), // old creation
      }),
      makeAction({
        id: "new-created",
        due_by: DateTime.now().minus({ days: 60 }), // old due date
        created_at: DateTime.now().minus({ days: 5 }), // recent creation
      }),
    ];

    const result = applyTimeFilter(
      actions,
      TimeRange.Last30Days,
      TimeField.CreatedDate
    );

    expect(result).toHaveLength(1);
    expect(result[0].action.id).toBe("new-created");
  });

  it("includes actions exactly on the 30-day boundary", () => {
    const actions = [
      makeAction({
        id: "boundary",
        due_by: DateTime.now().startOf("day").minus({ days: 30 }),
      }),
    ];

    const result = applyTimeFilter(actions, TimeRange.Last30Days, TimeField.DueDate);

    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    const result = applyTimeFilter([], TimeRange.Last30Days, TimeField.DueDate);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterByRelationship
// ---------------------------------------------------------------------------

describe("filterByRelationship", () => {
  const actions = [
    makeAction({ id: "a1", relationshipId: "rel-1" }),
    makeAction({ id: "a2", relationshipId: "rel-2" }),
    makeAction({ id: "a3", relationshipId: "rel-1" }),
  ];

  it("returns all actions when relationshipId is undefined", () => {
    const result = filterByRelationship(actions, undefined);
    expect(result).toHaveLength(3);
  });

  it("filters to only matching relationship", () => {
    const result = filterByRelationship(actions, "rel-1");
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.relationship.coachingRelationshipId === "rel-1")).toBe(true);
  });

  it("returns empty array for non-existent relationship", () => {
    const result = filterByRelationship(actions, "rel-nonexistent");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const result = filterByRelationship([], "rel-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// visibleStatuses
// ---------------------------------------------------------------------------

describe("visibleStatuses", () => {
  it("Open returns NotStarted and InProgress", () => {
    expect(visibleStatuses(StatusVisibility.Open)).toEqual([
      ItemStatus.NotStarted,
      ItemStatus.InProgress,
    ]);
  });

  it("All returns all 4 statuses in column order", () => {
    expect(visibleStatuses(StatusVisibility.All)).toEqual(STATUS_COLUMN_ORDER);
  });

  it("Closed returns Completed and WontDo", () => {
    expect(visibleStatuses(StatusVisibility.Closed)).toEqual([
      ItemStatus.Completed,
      ItemStatus.WontDo,
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildInitialOrder
// ---------------------------------------------------------------------------

describe("buildInitialOrder", () => {
  it("builds a fresh map from an empty previous map", () => {
    const result = buildInitialOrder(new Map(), ["a", "b", "c"]);
    expect(result).not.toBeNull();
    expect([...result!.entries()]).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });

  it("returns null when the ID set has not changed", () => {
    const previous = new Map([["a", 0], ["b", 1]]);
    expect(buildInitialOrder(previous, ["a", "b"])).toBeNull();
  });

  it("returns null when IDs are the same but in different order (SWR revalidation)", () => {
    const previous = new Map([["a", 0], ["b", 1]]);
    expect(buildInitialOrder(previous, ["b", "a"])).toBeNull();
  });

  it("appends new IDs at the end while preserving existing positions", () => {
    const previous = new Map([["a", 0], ["b", 1]]);
    const result = buildInitialOrder(previous, ["a", "b", "c"]);
    expect(result).not.toBeNull();
    expect([...result!.entries()]).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });

  it("removes IDs that are no longer present and re-indexes", () => {
    const previous = new Map([["a", 0], ["b", 1], ["c", 2]]);
    const result = buildInitialOrder(previous, ["a", "c"]);
    expect(result).not.toBeNull();
    expect([...result!.entries()]).toEqual([["a", 0], ["c", 1]]);
  });

  it("handles simultaneous additions and removals", () => {
    const previous = new Map([["a", 0], ["b", 1]]);
    const result = buildInitialOrder(previous, ["a", "c"]);
    expect(result).not.toBeNull();
    expect([...result!.entries()]).toEqual([["a", 0], ["c", 1]]);
  });

  it("returns a fresh map when all IDs are new", () => {
    const previous = new Map([["a", 0], ["b", 1]]);
    const result = buildInitialOrder(previous, ["x", "y"]);
    expect(result).not.toBeNull();
    expect([...result!.entries()]).toEqual([["x", 0], ["y", 1]]);
  });
});

// ---------------------------------------------------------------------------
// sortGroupedByInitialOrder
// ---------------------------------------------------------------------------

describe("sortGroupedByInitialOrder", () => {
  it("sorts actions within each status group by position map", () => {
    const actions = [
      makeAction({ id: "a3", status: ItemStatus.NotStarted }),
      makeAction({ id: "a1", status: ItemStatus.NotStarted }),
      makeAction({ id: "a2", status: ItemStatus.InProgress }),
    ];
    const grouped = groupByStatus(actions);
    const order = new Map([["a1", 0], ["a2", 1], ["a3", 2]]);

    const sorted = sortGroupedByInitialOrder(grouped, order);
    expect(sorted[ItemStatus.NotStarted].map((a) => a.action.id)).toEqual(["a1", "a3"]);
    expect(sorted[ItemStatus.InProgress].map((a) => a.action.id)).toEqual(["a2"]);
  });

  it("does not mutate the original grouped record", () => {
    const actions = [
      makeAction({ id: "a2", status: ItemStatus.NotStarted }),
      makeAction({ id: "a1", status: ItemStatus.NotStarted }),
    ];
    const grouped = groupByStatus(actions);
    const originalOrder = grouped[ItemStatus.NotStarted].map((a) => a.action.id);
    const order = new Map([["a1", 0], ["a2", 1]]);

    sortGroupedByInitialOrder(grouped, order);
    expect(grouped[ItemStatus.NotStarted].map((a) => a.action.id)).toEqual(originalOrder);
  });

  it("places actions not in the map at the end", () => {
    const actions = [
      makeAction({ id: "a1", status: ItemStatus.NotStarted }),
      makeAction({ id: "a2", status: ItemStatus.NotStarted }),
      makeAction({ id: "a3", status: ItemStatus.NotStarted }),
    ];
    const grouped = groupByStatus(actions);
    const order = new Map([["a3", 0], ["a1", 1]]);

    const sorted = sortGroupedByInitialOrder(grouped, order);
    expect(sorted[ItemStatus.NotStarted].map((a) => a.action.id)).toEqual(["a3", "a1", "a2"]);
  });
});
