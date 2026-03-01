import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { KanbanColumn } from "@/components/ui/actions/kanban-column";
import { TestProviders } from "@/test-utils/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

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

const cardProps = {
  locale: "en-US",
  onStatusChange: vi.fn(),
  onDueDateChange: vi.fn(),
  onAssigneesChange: vi.fn(),
  onBodyChange: vi.fn(),
  onDelete: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KanbanColumn", () => {
  it("renders column header with status name and count", () => {
    const actions = [
      makeAction("a1", ItemStatus.NotStarted),
      makeAction("a2", ItemStatus.NotStarted),
    ];

    render(
      <Wrapper>
        <KanbanColumn
          status={ItemStatus.NotStarted}
          actions={actions}
          cardProps={cardProps}
        />
      </Wrapper>
    );

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Not Started");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders 'No actions' when the column is empty", () => {
    render(
      <Wrapper>
        <KanbanColumn
          status={ItemStatus.InProgress}
          actions={[]}
          cardProps={cardProps}
        />
      </Wrapper>
    );

    expect(screen.getByText("No actions")).toBeInTheDocument();
  });

  describe("exitingIds", () => {
    it("applies exit animation class to cards in the exitingIds set", () => {
      const actions = [
        makeAction("a1", ItemStatus.NotStarted),
        makeAction("a2", ItemStatus.NotStarted),
      ];
      const exitingIds = new Set(["a1"]);

      const { container } = render(
        <Wrapper>
          <KanbanColumn
            status={ItemStatus.NotStarted}
            actions={actions}
            cardProps={cardProps}
            exitingIds={exitingIds}
          />
        </Wrapper>
      );

      const exitingWrappers = container.querySelectorAll(".animate-kanban-card-exit");
      expect(exitingWrappers).toHaveLength(1);
    });

    it("does not apply exit animation class to non-exiting cards", () => {
      const actions = [
        makeAction("a1", ItemStatus.NotStarted),
        makeAction("a2", ItemStatus.NotStarted),
      ];
      const exitingIds = new Set(["a1"]);

      const { container } = render(
        <Wrapper>
          <KanbanColumn
            status={ItemStatus.NotStarted}
            actions={actions}
            cardProps={cardProps}
            exitingIds={exitingIds}
          />
        </Wrapper>
      );

      // Both cards are rendered, but only one has the animation class
      const allCards = container.querySelectorAll("[data-kanban-card]");
      expect(allCards).toHaveLength(2);

      const exitingWrappers = container.querySelectorAll(".animate-kanban-card-exit");
      expect(exitingWrappers).toHaveLength(1);
    });

    it("excludes exiting cards from the count badge", () => {
      const actions = [
        makeAction("a1", ItemStatus.NotStarted),
        makeAction("a2", ItemStatus.NotStarted),
        makeAction("a3", ItemStatus.NotStarted),
      ];
      const exitingIds = new Set(["a1"]);

      render(
        <Wrapper>
          <KanbanColumn
            status={ItemStatus.NotStarted}
            actions={actions}
            cardProps={cardProps}
            exitingIds={exitingIds}
          />
        </Wrapper>
      );

      // 3 actions total, 1 exiting → count badge shows 2
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("shows full count when exitingIds is not provided", () => {
      const actions = [
        makeAction("a1", ItemStatus.NotStarted),
        makeAction("a2", ItemStatus.NotStarted),
      ];

      render(
        <Wrapper>
          <KanbanColumn
            status={ItemStatus.NotStarted}
            actions={actions}
            cardProps={cardProps}
          />
        </Wrapper>
      );

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("shows full count when exitingIds is empty", () => {
      const actions = [
        makeAction("a1", ItemStatus.NotStarted),
        makeAction("a2", ItemStatus.NotStarted),
      ];

      render(
        <Wrapper>
          <KanbanColumn
            status={ItemStatus.NotStarted}
            actions={actions}
            cardProps={cardProps}
            exitingIds={new Set()}
          />
        </Wrapper>
      );

      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});
