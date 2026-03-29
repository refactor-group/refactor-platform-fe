import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { ItemStatus } from "@/types/general";
import { createMockAction } from "../../../test-utils";

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const MOCK_COACH_ID = "coach-1";
const MOCK_COACH_NAME = "Jim Hodapp";
const MOCK_COACHEE_ID = "coachee-1";
const MOCK_COACHEE_NAME = "Caleb Bourg";

function baseProps(
  overrides?: Partial<Parameters<typeof ActionSectionContent>[0]>
) {
  return {
    reviewActions: [],
    sessionActions: [],
    locale: "en-US",
    coachId: MOCK_COACH_ID,
    coachName: MOCK_COACH_NAME,
    coacheeId: MOCK_COACHEE_ID,
    coacheeName: MOCK_COACHEE_NAME,
    isAddingAction: false,
    onAddingActionChange: vi.fn(),
    onStatusChange: vi.fn(),
    onDueDateChange: vi.fn(),
    onAssigneesChange: vi.fn(),
    onBodyChange: vi.fn().mockResolvedValue(undefined),
    onActionCreate: vi.fn().mockResolvedValue(undefined),
    onActionDelete: vi.fn(),
    ...overrides,
  };
}

describe("ActionSectionContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ���─ Sub-section headers ──────────────────────────────────────────

  describe("sub-section headers", () => {
    it("renders 'Due for Review' header with count", () => {
      const reviewActions = [
        createMockAction({ id: "review-1" }),
        createMockAction({ id: "review-2" }),
      ];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ reviewActions })} />
        </Wrapper>
      );

      const toggle = screen.getByTestId("review-section-toggle");
      expect(toggle.textContent).toContain("Due for Review");
      expect(toggle.textContent).toContain("(2)");
    });

    it("renders 'New This Session' header with count", () => {
      const sessionActions = [createMockAction({ id: "session-1" })];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ sessionActions })} />
        </Wrapper>
      );

      const toggle = screen.getByTestId("session-section-toggle");
      expect(toggle.textContent).toContain("New This Session");
      expect(toggle.textContent).toContain("(1)");
    });
  });

  // ── Collapse behavior ────────────────────────────────────────────

  describe("collapse behavior", () => {
    it("starts 'Due for Review' expanded when there are review actions", () => {
      const reviewActions = [createMockAction({ id: "review-1" })];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ reviewActions })} />
        </Wrapper>
      );

      // The review section content should not be hidden
      const reviewSection = screen.getByTestId("review-section-content");
      expect(reviewSection.className).not.toContain("hidden");
    });

    it("starts 'Due for Review' collapsed when there are no review actions", () => {
      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ reviewActions: [] })} />
        </Wrapper>
      );

      // The header should still be visible
      expect(screen.getByText(/Due for Review/)).toBeInTheDocument();
      // But the empty state should not be visible (collapsed)
      const reviewSection = screen.getByTestId("review-section-content");
      expect(reviewSection.className).toContain("hidden");
    });

    it("starts 'New This Session' expanded by default", () => {
      render(
        <Wrapper>
          <ActionSectionContent {...baseProps()} />
        </Wrapper>
      );

      // The "New This Session" content area should be visible
      const sessionSection = screen.getByTestId("session-section-content");
      expect(sessionSection.className).not.toContain("hidden");
    });

    it("collapses 'Due for Review' when header is clicked", async () => {
      const user = userEvent.setup();
      const reviewActions = [createMockAction({ id: "review-1" })];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ reviewActions })} />
        </Wrapper>
      );

      // Click the review section header to collapse
      await user.click(screen.getByTestId("review-section-toggle"));

      const reviewSection = screen.getByTestId("review-section-content");
      expect(reviewSection.className).toContain("hidden");
    });

    it("collapses 'New This Session' when header is clicked", async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps()} />
        </Wrapper>
      );

      // Click the session section header to collapse
      await user.click(screen.getByTestId("session-section-toggle"));

      const sessionSection = screen.getByTestId("session-section-content");
      expect(sessionSection.className).toContain("hidden");
    });
  });

  // ── Action cards rendering ───────────────────────────────────────

  describe("action cards", () => {
    it("renders review actions in the review section", () => {
      const reviewActions = [
        createMockAction({
          id: "review-1",
          body: "Review action one",
          assignee_ids: [MOCK_COACH_ID],
        }),
      ];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ reviewActions })} />
        </Wrapper>
      );

      // Text appears on both card faces; verify it exists in the review section
      const reviewContent = screen.getByTestId("review-section-content");
      expect(reviewContent.textContent).toContain("Review action one");
    });

    it("renders session actions in the session section", () => {
      const sessionActions = [
        createMockAction({
          id: "session-1",
          body: "Session action one",
          assignee_ids: [MOCK_COACHEE_ID],
        }),
      ];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ sessionActions })} />
        </Wrapper>
      );

      const sessionContent = screen.getByTestId("session-section-content");
      expect(sessionContent.textContent).toContain("Session action one");
    });
  });

  // ── Empty state ──────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows empty message when no session actions and not adding", () => {
      render(
        <Wrapper>
          <ActionSectionContent {...baseProps()} />
        </Wrapper>
      );

      expect(screen.getByText(/No actions yet/)).toBeInTheDocument();
    });
  });

  // ── Adding new action ────────────────────────────────────────────

  describe("adding new action", () => {
    it("renders a new action card in initial editing mode when isAddingAction is true", () => {
      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ isAddingAction: true })} />
        </Wrapper>
      );

      // Should show a textarea immediately for the new action
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });
});
