import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompactActionCard } from "@/components/ui/coaching-sessions/action-card-compact";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";
import { createMockAction, createMockGoal } from "../../../test-utils";

// Mock DueDatePicker to avoid coupling tests to the react-day-picker calendar
// DOM. The mock exposes a stable test button that simulates picking a date
// 60 days from "now" — deliberately relative so the test stays meaningful as
// time passes — plus a label that reflects the current `value` prop so we
// can assert that local state updates are reflected back into the picker.
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

function baseProps(overrides?: Partial<Parameters<typeof CompactActionCard>[0]>) {
  return {
    action: createMockAction(),
    locale: "en-US",
    coachId: MOCK_COACH_ID,
    coachName: MOCK_COACH_NAME,
    coacheeId: MOCK_COACHEE_ID,
    coacheeName: MOCK_COACHEE_NAME,
    onStatusChange: vi.fn(),
    onDueDateChange: vi.fn(),
    onAssigneesChange: vi.fn(),
    onBodyChange: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe("CompactActionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Front face: Header row ───────────────────────────────────────

  describe("front face header", () => {
    it("renders a status pill showing the current status text", () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      expect(screen.getByText("Not Started")).toBeInTheDocument();
    });

    it("renders a status pill with a different status", () => {
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ status: ItemStatus.InProgress }),
            })}
          />
        </Wrapper>
      );

      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });

    it("renders the flip info icon in the header", () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      expect(
        screen.getByRole("button", { name: /action options/i })
      ).toBeInTheDocument();
    });
  });

  // ── Front face: Body ─────────────────────────────────────────────

  describe("front face body", () => {
    it("renders the action body text on the front face", () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      // Text appears on both faces; verify at least one is in the front face
      const matches = screen.getAllByText("Follow up on resume review");
      const inFrontFace = matches.some(
        (el) => el.closest(".flip-card-front") !== null
      );
      expect(inFrontFace).toBe(true);
    });

    it("renders empty state when body is undefined", () => {
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ body: undefined }),
            })}
          />
        </Wrapper>
      );

      // Card should render without error
      expect(
        screen.getByRole("button", { name: /action options/i })
      ).toBeInTheDocument();
    });
  });

  // ── Front face: Footer row ───────────────────────────────────────

  describe("front face footer", () => {
    it("renders assignee initials", () => {
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ assignee_ids: [MOCK_COACH_ID] }),
            })}
          />
        </Wrapper>
      );

      expect(screen.getByText("JH")).toBeInTheDocument();
    });

    it("renders the due date in the footer", () => {
      const dueDate = DateTime.fromISO("2026-04-05");
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ due_by: Some(dueDate) }),
            })}
          />
        </Wrapper>
      );

      // Due date appears in the footer (data-testid) on the front face
      const dueDateEl = screen.getByTestId("action-due-date");
      expect(dueDateEl.textContent).toMatch(/Apr 5, 2026/);
    });

    it("renders the due date in bold when overdue", () => {
      const pastDate = DateTime.now().minus({ days: 3 });
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ due_by: Some(pastDate) }),
            })}
          />
        </Wrapper>
      );

      // Find the due date element and check for bold styling
      const dueDateEl = screen.getByTestId("action-due-date");
      expect(dueDateEl.className).toContain("font-bold");
    });
  });

  // ── Front face: Status pill presence ───────────────────────────────

  describe("status pill on front face", () => {
    it("renders the status pill as an interactive select trigger in the header", () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      // The status pill is a select trigger containing status text inside the header
      const statusText = screen.getByText("Not Started");
      const header = statusText.closest("[data-slot='card-header']");
      expect(header).not.toBeNull();
    });
  });

  // ── Flip to back face ────────────────────────────────────────────

  describe("flip interaction", () => {
    it("flips to back face when info icon is clicked", async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      await user.click(
        screen.getByRole("button", { name: /action options/i })
      );

      // Back face should show edit form elements
      const backFace = document.querySelector(".flip-card-back");
      expect(backFace).toHaveAttribute("aria-hidden", "false");
    });
  });

  // ── Back face: Edit form ─────────────────────────────────────────

  describe("back face", () => {
    async function flipToBack() {
      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", { name: /action options/i })
      );
      return user;
    }

    async function flipToBackAndEdit() {
      const user = await flipToBack();
      await user.click(screen.getByText("Edit"));
      return user;
    }

    it("shows back view with Edit and Delete buttons after flip", async () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      await flipToBack();

      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    it("shows a textarea with the action body after clicking Edit", async () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      await flipToBackAndEdit();

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("Follow up on resume review");
    });

    it("shows Save and Cancel buttons in edit mode (Save first)", async () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      await flipToBackAndEdit();

      const buttons = screen.getAllByRole("button");
      const saveButton = buttons.find((b) => b.textContent === "Save");
      const cancelButton = buttons.find((b) => b.textContent === "Cancel");

      expect(saveButton).toBeDefined();
      expect(cancelButton).toBeDefined();
    });

    it("shows Delete button for non-review variant", async () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      await flipToBack();

      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("hides Delete button for review variant", async () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps({ variant: "review" })} />
        </Wrapper>
      );

      await flipToBack();

      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    });

    it("allows body editing for review variant in edit mode", async () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps({ variant: "review" })} />
        </Wrapper>
      );

      const user = await flipToBack();
      await user.click(screen.getByText("Edit"));

      // Review cards now allow body editing
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("Follow up on resume review");
    });

    it("calls onBodyChange when Save is clicked after editing", async () => {
      const onBodyChange = vi.fn().mockResolvedValue(undefined);
      render(
        <Wrapper>
          <CompactActionCard {...baseProps({ onBodyChange })} />
        </Wrapper>
      );

      const user = await flipToBackAndEdit();

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Updated action text");
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(onBodyChange).toHaveBeenCalledWith(
          "action-1",
          "Updated action text",
          expect.any(Array),
          undefined, // goalId — no goal selected
          undefined // dueBy — only passed for new (initialEditing) actions
        );
      });
    });

    it("calls onDelete when Delete is clicked", async () => {
      const onDelete = vi.fn();
      render(
        <Wrapper>
          <CompactActionCard {...baseProps({ onDelete })} />
        </Wrapper>
      );

      await flipToBack();

      await userEvent.click(screen.getByText("Delete"));

      expect(onDelete).toHaveBeenCalledWith("action-1");
    });
  });

  // ── Initial editing mode (new action) ────────────────────────────

  describe("initial editing mode", () => {
    it("shows the back face directly when initialEditing is true", () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps({ initialEditing: true })} />
        </Wrapper>
      );

      // Should show a textarea immediately, no flip needed
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("tracks due-date selection locally and passes dueBy to onBodyChange on save", async () => {
      const user = userEvent.setup();
      const onBodyChange = vi.fn().mockResolvedValue(undefined);
      // The non-editing onDueDateChange must NOT be called for new (unsaved)
      // actions, because the action has no id yet.
      const onDueDateChange = vi.fn();

      // Relative initial date so the test remains meaningful over time.
      const initialDueBy = DateTime.now().plus({ days: 1 }).startOf("day");
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ id: "", body: "", due_by: Some(initialDueBy) }),
              initialEditing: true,
              onBodyChange,
              onDueDateChange,
            })}
          />
        </Wrapper>
      );

      // The picker initially reflects the placeholder's due_by.
      expect(
        screen.getByTestId("mock-due-date-value").textContent
      ).toBe(initialDueBy.toISODate());

      // Simulate picking a new date in the calendar.
      await user.click(screen.getByTestId("mock-due-date-pick"));

      // The picker re-renders with the locally tracked due-date — the bug
      // was that selections silently no-op'd because action.id is "".
      const expectedPickedIso = pickedDate().toISODate();
      expect(
        screen.getByTestId("mock-due-date-value").textContent
      ).toBe(expectedPickedIso);

      // The non-editing handler is bypassed for new actions.
      expect(onDueDateChange).not.toHaveBeenCalled();

      // Type a body so Save isn't disabled, then save.
      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "New action body");
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(onBodyChange).toHaveBeenCalled();
      });

      // Last arg is the locally picked dueBy DateTime.
      const callArgs = onBodyChange.mock.calls[0];
      expect(callArgs[0]).toBe(""); // empty id for new action
      expect(callArgs[1]).toBe("New action body");
      const passedDueBy = callArgs[4] as DateTime;
      expect(passedDueBy).toBeInstanceOf(DateTime);
      expect(passedDueBy.toISODate()).toBe(expectedPickedIso);
    });

    it("calls onDismiss when Cancel is clicked in initial editing mode", async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();

      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({ initialEditing: true, onDismiss })}
          />
        </Wrapper>
      );

      await user.click(screen.getByText("Cancel"));

      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  // ── Highlight ────────────────────────────────────────────────────

  describe("highlight", () => {
    it("applies highlight ring when highlighted is true", () => {
      const { container } = render(
        <Wrapper>
          <CompactActionCard {...baseProps({ highlighted: true })} />
        </Wrapper>
      );

      const flipCard = container.firstChild as HTMLElement;
      expect(flipCard.className).toContain("ring-2");
      expect(flipCard.className).toContain("ring-primary/40");
    });

    it("does not apply highlight ring by default", () => {
      const { container } = render(
        <Wrapper>
          <CompactActionCard {...baseProps()} />
        </Wrapper>
      );

      const flipCard = container.firstChild as HTMLElement;
      expect(flipCard.className).not.toContain("ring-2");
    });
  });

  // ── Goal pill on front face ──────────────────────────────────────

  describe("goal pill", () => {
    const GOALS = [
      createMockGoal({ id: "goal-1", title: "Improve communication" }),
      createMockGoal({ id: "goal-2", title: "Build leadership skills" }),
    ];

    it("renders goal pill when action body is expanded and has goal_id", async () => {
      const user = userEvent.setup();
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ goal_id: Some("goal-1") }),
              goals: GOALS,
            })}
          />
        </Wrapper>
      );

      // Before expanding, only the back-face pill exists (front face not expanded)
      const pillsBefore = screen.queryAllByTestId("goal-pill");
      expect(pillsBefore).toHaveLength(1);

      // Click the body text to expand it (appears on both faces; pick the front)
      const bodyTexts = screen.getAllByText("Follow up on resume review");
      await user.click(bodyTexts[0]);

      // After expanding, both front-face and back-face pills are present
      const pillsAfter = screen.getAllByTestId("goal-pill");
      expect(pillsAfter).toHaveLength(2);
      expect(pillsAfter[0]).toHaveTextContent("Improve communication");
    });

    it("does not render goal pill when action has no goal_id", () => {
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({ goals: GOALS })}
          />
        </Wrapper>
      );

      expect(screen.queryByTestId("goal-pill")).not.toBeInTheDocument();
    });

    it("does not render goal pill when goals prop is not provided", () => {
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              action: createMockAction({ goal_id: Some("goal-1") }),
            })}
          />
        </Wrapper>
      );

      expect(screen.queryByTestId("goal-pill")).not.toBeInTheDocument();
    });
  });

  // ── Goal picker in edit form ────────────────────────────────────

  describe("goal picker in edit form", () => {
    const GOALS = [
      createMockGoal({ id: "goal-1", title: "Improve communication" }),
      createMockGoal({ id: "goal-2", title: "Build leadership skills" }),
    ];

    it("shows goal picker row in edit form when goals are provided", async () => {
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({ goals: GOALS })}
          />
        </Wrapper>
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /action options/i }));
      await user.click(screen.getByText("Edit"));

      expect(screen.getByText("Linked goal")).toBeInTheDocument();
      expect(screen.getByText("None")).toBeInTheDocument();
    });
  });

  // ── Source session link ──────────────────────────────────────────

  describe("source session link", () => {
    it("renders a source session link on review card back face", async () => {
      render(
        <Wrapper>
          <CompactActionCard
            {...baseProps({
              variant: "review",
              sourceSessionId: "session-99",
              sourceSessionDate: DateTime.fromISO("2026-03-17"),
            })}
          />
        </Wrapper>
      );

      const user = userEvent.setup();
      // Flip to back face
      await user.click(
        screen.getByRole("button", { name: /action options/i })
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "/coaching-sessions/session-99?panel=actions&highlight=action-1"
      );
    });

    it("does not render source session link on current variant", async () => {
      render(
        <Wrapper>
          <CompactActionCard {...baseProps({ variant: "current" })} />
        </Wrapper>
      );

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", { name: /action options/i })
      );

      expect(screen.queryByRole("link")).toBeNull();
    });
  });
});
