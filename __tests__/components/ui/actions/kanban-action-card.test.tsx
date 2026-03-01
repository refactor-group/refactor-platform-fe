import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { KanbanActionCard } from "@/components/ui/actions/kanban-action-card";
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

function makeCtx(
  id: string,
  status: ItemStatus
): AssignedActionWithContext {
  return {
    action: {
      id,
      coaching_session_id: "session-42",
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
      coachingSessionId: "session-42",
      sessionDate: now.minus({ days: 1 }),
    },
    nextSession: null,
    isOverdue: false,
  };
}

const defaultProps = {
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

describe("KanbanActionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders relationship badge", () => {
    render(
      <Wrapper>
        <KanbanActionCard ctx={makeCtx("a1", ItemStatus.NotStarted)} {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText("Alice Smith → Bob Jones")).toBeInTheDocument();
  });

  it("renders action body text", () => {
    render(
      <Wrapper>
        <KanbanActionCard ctx={makeCtx("a1", ItemStatus.NotStarted)} {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText("Action a1")).toBeInTheDocument();
  });

  it("renders a session link via showSessionLink on the inner card", () => {
    render(
      <Wrapper>
        <KanbanActionCard ctx={makeCtx("a1", ItemStatus.NotStarted)} {...defaultProps} />
      </Wrapper>
    );

    const sessionLink = screen.getByRole("link", { name: /From:/i });
    expect(sessionLink).toBeInTheDocument();
    expect(sessionLink).toHaveAttribute(
      "href",
      "/coaching-sessions/session-42?tab=actions"
    );
  });

  it("renders drag handle", () => {
    render(
      <Wrapper>
        <KanbanActionCard ctx={makeCtx("a1", ItemStatus.NotStarted)} {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByLabelText("Drag to move")).toBeInTheDocument();
  });

  it("applies highlight ring when justMoved is true", () => {
    const { container } = render(
      <Wrapper>
        <KanbanActionCard
          ctx={makeCtx("a1", ItemStatus.NotStarted)}
          {...defaultProps}
          justMoved
        />
      </Wrapper>
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("ring-2");
    expect(outerDiv.className).toContain("ring-primary/40");
  });

  it("does not apply highlight ring by default", () => {
    const { container } = render(
      <Wrapper>
        <KanbanActionCard ctx={makeCtx("a1", ItemStatus.NotStarted)} {...defaultProps} />
      </Wrapper>
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).not.toContain("ring-2");
  });

  it("does not render drag handle when isOverlay is true", () => {
    render(
      <Wrapper>
        <KanbanActionCard
          ctx={makeCtx("a1", ItemStatus.NotStarted)}
          {...defaultProps}
          isOverlay
        />
      </Wrapper>
    );

    expect(screen.queryByLabelText("Drag to move")).not.toBeInTheDocument();
  });
});
