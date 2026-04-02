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

  // ── Tab headers ──────────────────────────────────────────────────

  describe("tab headers", () => {
    it("renders 'Due' tab with count", () => {
      const reviewActions = [
        createMockAction({ id: "review-1" }),
        createMockAction({ id: "review-2" }),
      ];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ reviewActions })} />
        </Wrapper>
      );

      const tab = screen.getByTestId("action-tab-due");
      expect(tab.textContent).toContain("Due");
      expect(tab.textContent).toContain("(2)");
    });

    it("renders 'New' tab with count", () => {
      const sessionActions = [createMockAction({ id: "session-1" })];

      render(
        <Wrapper>
          <ActionSectionContent {...baseProps({ sessionActions })} />
        </Wrapper>
      );

      const tab = screen.getByTestId("action-tab-new");
      expect(tab.textContent).toContain("New");
      expect(tab.textContent).toContain("(1)");
    });
  });

  // ── Tab switching ────────────────────────────────────────────────

  describe("tab switching", () => {
    it("defaults to the 'New' tab", () => {
      render(
        <Wrapper>
          <ActionSectionContent {...baseProps()} />
        </Wrapper>
      );

      // The session content area should be visible
      const sessionContent = screen.getByTestId("session-section-content");
      expect(sessionContent).toBeInTheDocument();
    });

    it("switches to 'Due' tab when clicked", async () => {
      const user = userEvent.setup();
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

      await user.click(screen.getByTestId("action-tab-due"));

      const reviewContent = screen.getByTestId("review-section-content");
      expect(reviewContent.textContent).toContain("Review action one");
    });

    it("calls onActiveTabChange when tab switches", async () => {
      const user = userEvent.setup();
      const onActiveTabChange = vi.fn();

      render(
        <Wrapper>
          <ActionSectionContent
            {...baseProps({ onActiveTabChange })}
          />
        </Wrapper>
      );

      await user.click(screen.getByTestId("action-tab-due"));
      expect(onActiveTabChange).toHaveBeenCalledWith("due");
    });
  });

  // ── Action cards rendering ───────────────────────────────────────

  describe("action cards", () => {
    it("renders review actions in the Due tab", async () => {
      const user = userEvent.setup();
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

      await user.click(screen.getByTestId("action-tab-due"));

      const reviewContent = screen.getByTestId("review-section-content");
      expect(reviewContent.textContent).toContain("Review action one");
    });

    it("renders session actions in the New tab", () => {
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
