import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ActionsSummary } from "@/components/ui/dashboard/actions-summary";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";

/**
 * Test Suite: ActionsSummary Component
 *
 * Tests the clickable action summary link displayed on TodaySessionCard.
 * Covers: zero actions, counts, overdue indicators, link target.
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

    it("should not render a link when there are no actions", () => {
      render(<ActionsSummary actions={[]} sessionId="session-1" />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("action counts", () => {
    it("should show action count", () => {
      const actions = [createAction(), createAction(), createAction()];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText(/3/)).toBeInTheDocument();
      expect(screen.getByText(/actions/)).toBeInTheDocument();
      expect(screen.getByText(/due assigned to you/)).toBeInTheDocument();
    });

    it("should use singular 'action' for count of 1", () => {
      const actions = [createAction()];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText(/1/)).toBeInTheDocument();
      expect(screen.getByText(/action\b/)).toBeInTheDocument();
    });

    it("should exclude completed and WontDo actions from the total count", () => {
      const actions = [
        createAction({ status: ItemStatus.NotStarted }),
        createAction({ status: ItemStatus.InProgress }),
        createAction({ status: ItemStatus.Completed }),
        createAction({ status: ItemStatus.WontDo }),
      ];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText(/2/)).toBeInTheDocument();
      expect(screen.getByText(/actions/)).toBeInTheDocument();
    });

    it("should render 'No actions due' when all actions are completed or WontDo", () => {
      const actions = [
        createAction({ status: ItemStatus.Completed }),
        createAction({ status: ItemStatus.WontDo }),
      ];
      render(<ActionsSummary actions={actions} sessionId="session-1" />);
      expect(screen.getByText("No actions due")).toBeInTheDocument();
    });
  });

  describe("link behavior", () => {
    it("should link to the session's actions tab with review=true", () => {
      const actions = [createAction()];
      render(<ActionsSummary actions={actions} sessionId="session-42" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "/coaching-sessions/session-42?tab=actions&review=true"
      );
    });
  });
});
