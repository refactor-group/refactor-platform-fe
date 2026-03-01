import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { StatusVisibility } from "@/types/assigned-actions";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { KanbanBoard } from "@/components/ui/actions/kanban-board";
import { TestProviders } from "@/test-utils/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock react-syntax-highlighter (used by SessionActionCard's markdown renderer)
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => children,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <TestProviders>
      <TooltipProvider>{children}</TooltipProvider>
    </TestProviders>
  );
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = DateTime.now();

function makeAction(
  id: string,
  status: ItemStatus
): AssignedActionWithContext {
  return {
    action: {
      id,
      coaching_session_id: "session-1",
      body: `Action ${id}`,
      user_id: "user-1",
      status,
      status_changed_at: now,
      due_by: now.plus({ days: 7 }),
      created_at: now,
      updated_at: now,
      assignee_ids: ["user-1"],
    },
    relationship: {
      id: "rel-1",
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      created_at: now,
      updated_at: now,
      coach_first_name: "Alice",
      coach_last_name: "Smith",
      coachee_first_name: "Bob",
      coachee_last_name: "Jones",
    },
    goal: {
      goalId: "goal-1",
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

const testActions: AssignedActionWithContext[] = [
  makeAction("a1", ItemStatus.NotStarted),
  makeAction("a2", ItemStatus.InProgress),
  makeAction("a3", ItemStatus.Completed),
  makeAction("a4", ItemStatus.WontDo),
];

const defaultProps = {
  actions: testActions,
  visibility: StatusVisibility.All,
  locale: "en-US",
  onStatusChange: vi.fn().mockResolvedValue(undefined),
  onVisibilityChange: vi.fn(),
  onDueDateChange: vi.fn(),
  onAssigneesChange: vi.fn(),
  onBodyChange: vi.fn(),
  onDelete: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: column headers are rendered as <h3> elements
  function getColumnHeaders() {
    return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  }

  it("renders all 4 columns when visibility is All", () => {
    render(
      <Wrapper>
        <KanbanBoard {...defaultProps} visibility={StatusVisibility.All} />
      </Wrapper>
    );

    const headers = getColumnHeaders();
    expect(headers).toContain("Not Started");
    expect(headers).toContain("In Progress");
    expect(headers).toContain("Completed");
    expect(headers).toContain("Won't Do");
  });

  it("renders only Open columns when visibility is Open", () => {
    render(
      <Wrapper>
        <KanbanBoard {...defaultProps} visibility={StatusVisibility.Open} />
      </Wrapper>
    );

    const headers = getColumnHeaders();
    expect(headers).toContain("Not Started");
    expect(headers).toContain("In Progress");
    expect(headers).not.toContain("Completed");
    expect(headers).not.toContain("Won't Do");
  });

  it("renders only Closed columns when visibility is Closed", () => {
    render(
      <Wrapper>
        <KanbanBoard {...defaultProps} visibility={StatusVisibility.Closed} />
      </Wrapper>
    );

    const headers = getColumnHeaders();
    expect(headers).not.toContain("Not Started");
    expect(headers).not.toContain("In Progress");
    expect(headers).toContain("Completed");
    expect(headers).toContain("Won't Do");
  });

  it("renders empty columns with 'No actions' text", () => {
    render(
      <Wrapper>
        <KanbanBoard {...defaultProps} actions={[]} />
      </Wrapper>
    );

    const emptyMessages = screen.getAllByText("No actions");
    expect(emptyMessages).toHaveLength(4);
  });

  it("shows correct count badges for columns", () => {
    const actions = [
      makeAction("a1", ItemStatus.NotStarted),
      makeAction("a2", ItemStatus.NotStarted),
      makeAction("a3", ItemStatus.InProgress),
    ];

    render(
      <Wrapper>
        <KanbanBoard {...defaultProps} actions={actions} visibility={StatusVisibility.All} />
      </Wrapper>
    );

    // Count badges are rendered as text
    // NotStarted: 2, InProgress: 1, Completed: 0, WontDo: 0
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    // Two columns with 0 count
    const zeroBadges = screen.getAllByText("0");
    expect(zeroBadges).toHaveLength(2);
  });
});
