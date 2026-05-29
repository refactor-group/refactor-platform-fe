import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";
import { createMockAction } from "../../../test-utils";

// Same DueDatePicker mock as in the action-card test — exposes a stable
// "pick" button that simulates selecting a date 60 days from "now"
// (relative so the test stays meaningful as time passes).
function pickedDate(): DateTime {
  return DateTime.now().plus({ days: 60 }).startOf("day");
}
vi.mock("@/components/ui/coaching-sessions/action-card-parts", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/ui/coaching-sessions/action-card-parts")
  >("@/components/ui/coaching-sessions/action-card-parts");
  return {
    ...actual,
    DueDatePicker: ({
      value,
      onChange,
    }: {
      value: DateTime;
      onChange: (date: DateTime) => void;
      locale: string;
      variant?: "button" | "text";
    }) => (
      <div>
        <span data-testid="mock-due-date-value">{value.toISODate()}</span>
        <button
          type="button"
          data-testid="mock-due-date-pick"
          onClick={() => onChange(pickedDate())}
        >
          pick
        </button>
      </div>
    ),
  };
});

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

    it("forwards a user-picked due date through onActionCreate", async () => {
      const user = userEvent.setup();
      const onActionCreate = vi.fn().mockResolvedValue(undefined);
      const onAddingActionChange = vi.fn();

      render(
        <Wrapper>
          <ActionSectionContent
            {...baseProps({
              isAddingAction: true,
              onActionCreate,
              onAddingActionChange,
            })}
          />
        </Wrapper>
      );

      // Pick a new date in the mocked DueDatePicker.
      await user.click(screen.getByTestId("mock-due-date-pick"));

      // The picker reflects the new local value (proves state update wiring).
      const expectedPickedIso = pickedDate().toISODate();
      expect(
        screen.getByTestId("mock-due-date-value").textContent
      ).toBe(expectedPickedIso);

      // Type a body, then save.
      await user.type(screen.getByRole("textbox"), "Action with picked date");
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(onActionCreate).toHaveBeenCalledTimes(1);
      });

      const [body, _assigneeIds, _goalId, dueBy] =
        onActionCreate.mock.calls[0] as [string, unknown, unknown, DateTime];
      expect(body).toBe("Action with picked date");
      expect(dueBy).toBeInstanceOf(DateTime);
      expect(dueBy.toISODate()).toBe(expectedPickedIso);

      // After save, parent is notified that adding is done.
      expect(onAddingActionChange).toHaveBeenCalledWith(false);
    });

    it("fills the add-form body from a notes selection, then appends on a new nonce", async () => {
      const { rerender } = render(
        <Wrapper>
          <ActionSectionContent
            {...baseProps({
              isAddingAction: true,
              actionBodyAppend: Some({ text: "First selection", nonce: 1 }),
            })}
          />
        </Wrapper>
      );

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      await waitFor(() => expect(textarea.value).toBe("First selection"));

      // A new nonce appends as a new paragraph rather than replacing.
      rerender(
        <Wrapper>
          <ActionSectionContent
            {...baseProps({
              isAddingAction: true,
              actionBodyAppend: Some({ text: "Second selection", nonce: 2 }),
            })}
          />
        </Wrapper>
      );

      await waitFor(() =>
        expect(textarea.value).toBe("First selection\n\nSecond selection")
      );
    });
  });
});
