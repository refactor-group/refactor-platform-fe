import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { KanbanActionCard } from "@/components/ui/actions/kanban-action-card";
import { TestProviders } from "@/test-utils/providers";
import { TooltipProvider } from "@/components/ui/tooltip";


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
  onBodyChange: vi.fn().mockResolvedValue(undefined),
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

  it("renders action body text on the front face", () => {
    render(
      <Wrapper>
        <KanbanActionCard ctx={makeCtx("a1", ItemStatus.NotStarted)} {...defaultProps} />
      </Wrapper>
    );

    // Text appears on both card faces; verify at least one is in the front face
    const matches = screen.getAllByText("Action a1");
    const inFrontFace = matches.some(
      (el) => el.closest(".flip-card-front") !== null
    );
    expect(inFrontFace).toBe(true);
  });

  it("renders a status pill on the compact card", () => {
    render(
      <Wrapper>
        <KanbanActionCard ctx={makeCtx("a1", ItemStatus.NotStarted)} {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText("Not Started")).toBeInTheDocument();
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
