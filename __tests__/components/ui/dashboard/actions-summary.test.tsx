import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ActionsSummary } from "@/components/ui/dashboard/actions-summary";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";

/**
 * Test Suite: ActionsSummary Component
 *
 * Tests the collapsible inline action summary displayed on TodaySessionCard.
 * Covers: zero actions, counts, overdue indicators, expand/collapse,
 * overflow (>5 actions), progress display.
 */

const mockRelationship: CoachingRelationshipWithUserNames = {
  id: "rel-1",
  coach_id: "coach-1",
  coachee_id: "coachee-1",
  organization_id: "org-1",
  coach_first_name: "Coach",
  coach_last_name: "Person",
  coachee_first_name: "Coachee",
  coachee_last_name: "Person",
  created_at: DateTime.now(),
  updated_at: DateTime.now(),
};

const mockGoal = {
  overarchingGoalId: "goal-1",
  title: "Test Goal",
};

const mockSourceSession = {
  coachingSessionId: "session-src",
  sessionDate: DateTime.now().minus({ days: 7 }),
};

function createAction(
  overrides: Partial<{
    id: string;
    body: string;
    status: ItemStatus;
    isOverdue: boolean;
    due_by: DateTime;
  }> = {}
): AssignedActionWithContext {
  return {
    action: {
      id: overrides.id ?? `action-${Math.random().toString(36).slice(2)}`,
      coaching_session_id: "session-1",
      body: overrides.body ?? "Test action",
      user_id: "user-1",
      status: overrides.status ?? ItemStatus.NotStarted,
      status_changed_at: DateTime.now(),
      due_by: overrides.due_by ?? DateTime.now().plus({ days: 1 }),
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
    },
    relationship: mockRelationship,
    goal: mockGoal,
    sourceSession: mockSourceSession,
    nextSession: null,
    isOverdue: overrides.isOverdue ?? false,
  };
}

describe("ActionsSummary", () => {
  describe("zero actions", () => {
    it("should render 'No actions due' when actions array is empty", () => {
      render(<ActionsSummary actions={[]} sessionId="session-1" />);
      expect(screen.getByText("No actions due")).toBeInTheDocument();
    });

    it("should not render a chevron when there are no actions", () => {
      const { container } = render(
        <ActionsSummary actions={[]} sessionId="session-1" />
      );
      // No chevron SVGs for expand/collapse
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(0);
    });
  });

  describe("collapsed state with actions", () => {
    it("should show action count in trigger", () => {
      const actions = [createAction(), createAction(), createAction()];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText(/3/)).toBeInTheDocument();
      expect(screen.getByText(/actions/)).toBeInTheDocument();
      expect(screen.getByText(/due/)).toBeInTheDocument();
    });

    it("should use singular 'action' for count of 1", () => {
      const actions = [createAction()];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText(/1/)).toBeInTheDocument();
      expect(screen.getByText(/action\b/)).toBeInTheDocument();
    });

    it("should show overdue count when actions are overdue", () => {
      const actions = [
        createAction({ isOverdue: true }),
        createAction({ isOverdue: true }),
        createAction({ isOverdue: false }),
      ];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText(/2 overdue/)).toBeInTheDocument();
    });

    it("should not show overdue text when no actions are overdue", () => {
      const actions = [createAction({ isOverdue: false })];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    });

    it("should not count completed actions as overdue", () => {
      const actions = [
        createAction({ isOverdue: true, status: ItemStatus.Completed }),
        createAction({ isOverdue: true, status: ItemStatus.NotStarted }),
      ];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText(/1 overdue/)).toBeInTheDocument();
    });
  });

  describe("expand/collapse", () => {
    it("should show action body text when expanded", () => {
      const actions = [
        createAction({ body: "Review Q4 performance" }),
        createAction({ body: "Draft mentoring plan" }),
      ];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);

      // Click the trigger to expand
      const trigger = screen.getByRole("button");
      fireEvent.click(trigger);

      expect(screen.getByText("Review Q4 performance")).toBeInTheDocument();
      expect(screen.getByText("Draft mentoring plan")).toBeInTheDocument();
    });

    it("should show 'Untitled action' for actions without a body", () => {
      const action = createAction();
      // Simulate missing body by deleting it after creation
      delete (action.action as Record<string, unknown>).body;
      render(<ActionsSummary actions={[action]} sessionId="session-1" />);

      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByText("Untitled action")).toBeInTheDocument();
    });
  });

  describe("overflow (>5 actions)", () => {
    it("should show only first 5 actions and overflow link", () => {
      const actions = Array.from({ length: 8 }, (_, i) =>
        createAction({ id: `action-${i}`, body: `Action item ${i + 1}` })
      );
      render(<ActionsSummary actions={actions} sessionId="session-42" />);

      fireEvent.click(screen.getByRole("button"));

      // First 5 visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Action item ${i}`)).toBeInTheDocument();
      }
      // 6th, 7th, 8th not visible
      expect(screen.queryByText("Action item 6")).not.toBeInTheDocument();

      // Overflow link
      expect(screen.getByText(/\+ 3 more/)).toBeInTheDocument();
      const overflowLink = screen.getByText(/View all actions/);
      expect(overflowLink.closest("a")).toHaveAttribute(
        "href",
        "/coaching-sessions/session-42?tab=actions"
      );
    });

    it("should not show overflow link when 5 or fewer actions", () => {
      const actions = Array.from({ length: 5 }, (_, i) =>
        createAction({ id: `action-${i}`, body: `Action ${i + 1}` })
      );
      render(<ActionsSummary actions={actions} sessionId="session-1" />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });
  });

  describe("visual styling", () => {
    it("should apply line-through to completed action text", () => {
      const actions = [
        createAction({ body: "Done task", status: ItemStatus.Completed }),
      ];
      const { container } = render(
        <ActionsSummary actions={actions} sessionId="session-1" />
      );

      fireEvent.click(screen.getByRole("button"));

      const actionText = screen.getByText("Done task");
      expect(actionText.className).toContain("line-through");
    });

    it("should apply bold styling to overdue action text", () => {
      const actions = [
        createAction({ body: "Overdue task", isOverdue: true }),
      ];
      const { container } = render(
        <ActionsSummary actions={actions} sessionId="session-1" />
      );

      fireEvent.click(screen.getByRole("button"));

      const actionText = screen.getByText("Overdue task");
      expect(actionText.className).toContain("font-semibold");
    });

    it("should apply truncate class to action text for mobile", () => {
      const actions = [createAction({ body: "A very long action body text" })];
      const { container } = render(
        <ActionsSummary actions={actions} sessionId="session-1" />
      );

      fireEvent.click(screen.getByRole("button"));

      const actionText = screen.getByText("A very long action body text");
      expect(actionText.className).toContain("truncate");
    });
  });
});
