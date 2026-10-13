// Frozen acceptance test for fe#477 phase 3: accepting, dismissing and editing
// a suggestion from its card, and the highlight on the action an accept creates.

import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionEdits, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None, type Option } from "@/types/option";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { createMockAction } from "../../../test-utils";

// Stand-in date picker: shows the preselected date and picks a fixed one.
const PICKED = DateTime.fromISO("2026-11-02T12:00:00Z");
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
    }) => (
      <div>
        <span data-testid="mock-due-date-value">{value.toISODate()}</span>
        <button type="button" data-testid="mock-due-date-pick" onClick={() => onChange(PICKED)}>
          pick
        </button>
      </div>
    ),
  };
});

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const COACH_ID = "coach-1";
const COACHEE_ID = "coachee-1";
const people = {
  locale: "en-US",
  coachId: COACH_ID,
  coachName: "Jim Hodapp",
  coacheeId: COACHEE_ID,
  coacheeName: "Caleb Bourg",
};
const noon = (isoDate: string) => DateTime.fromISO(`${isoDate}T12:00:00Z`);

function makeSuggestion(
  overrides: { id?: Id; assignees?: Id[]; dueBy?: DateTime | null } = {}
): ActionSuggestion {
  const dueBy = overrides.dueBy === undefined ? noon("2026-10-17") : overrides.dueBy;
  return {
    id: overrides.id ?? "sug-1",
    coaching_session_id: "s-1",
    proposal: {
      ...createMockAction({
        body: "Send the hiring plan to Dana",
        due_by: dueBy ? Some(dueBy) : None,
        assignee_ids: overrides.assignees ?? [COACHEE_ID],
      }),
      due_phrase: None,
    },
    quote: "I'll send Dana the hiring plan.",
    segment: { id: "seg-9", start_ms: 754000, speaker_role: None, speaker_label: "Caleb Bourg" },
    duplicate_of: None,
    default_due: { at: noon("2026-10-18"), source: Some(DueSource.NextSession) },
    created_at: noon("2026-10-11"),
  };
}

const ACCEPT = { name: "Accept" };
const DISMISS = { name: "Dismiss" };
const EDIT = { name: "Edit" };

describe("SuggestedActionCard actions", () => {
  beforeEach(() => vi.clearAllMocks());

  function renderCard(
    suggestion: ActionSuggestion,
    viewerRole: RelationshipRole,
    handlers: {
      onAccept?: (edits: Option<ActionEdits>) => Promise<void>;
      onDismiss?: () => Promise<void>;
    }
  ) {
    return render(
      <Wrapper>
        <SuggestedActionCard
          suggestion={suggestion}
          viewerRole={viewerRole}
          {...people}
          {...handlers}
        />
      </Wrapper>
    );
  }

  it("accepts and dismisses from the header", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    renderCard(makeSuggestion(), RelationshipRole.Coach, { onAccept, onDismiss });

    await userEvent.click(screen.getByRole("button", ACCEPT));
    expect(onAccept).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", DISMISS));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("blocks a second press while a request is in flight", async () => {
    const onAccept = vi.fn(() => new Promise<void>(() => {}));
    renderCard(makeSuggestion(), RelationshipRole.Coach, { onAccept });

    await userEvent.click(screen.getByRole("button", ACCEPT));
    expect(screen.getByRole("button", ACCEPT)).toBeDisabled();
    expect(screen.getByRole("button", DISMISS)).toBeDisabled();
    await userEvent.click(screen.getByRole("button", ACCEPT));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("edits and accepts with the edits", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    renderCard(makeSuggestion(), RelationshipRole.Coach, { onAccept });

    await userEvent.click(screen.getByRole("button", EDIT));
    const textbox = screen.getByRole("textbox");
    expect(textbox).toHaveValue("Send the hiring plan to Dana");
    expect(screen.getByText("Due date")).toBeInTheDocument();
    expect(screen.getByTestId("mock-due-date-value")).toHaveTextContent("2026-10-17");

    await userEvent.clear(textbox);
    await userEvent.type(textbox, "Send the revised plan");
    await userEvent.click(screen.getByTestId("mock-due-date-pick"));
    await userEvent.click(screen.getByRole("button", { name: "Assignees" }));
    await userEvent.click(await screen.findByRole("option", { name: /Jim Hodapp/ }));
    await userEvent.click(screen.getByRole("button", ACCEPT));

    expect(onAccept).toHaveBeenCalledTimes(1);
    const sent: ActionEdits = onAccept.mock.calls[0][0].val;
    expect(sent.body).toBe("Send the revised plan");
    expect(sent.due_by).toEqual(Some(PICKED));
    expect([...sent.assignee_ids].sort()).toEqual([COACH_ID, COACHEE_ID].sort());
  });

  it("preselects the default due date but sends no date unless one is picked", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    renderCard(makeSuggestion({ dueBy: null }), RelationshipRole.Coach, { onAccept });

    await userEvent.click(screen.getByRole("button", EDIT));
    expect(screen.getByTestId("mock-due-date-value")).toHaveTextContent("2026-10-18");
    await userEvent.click(screen.getByRole("button", ACCEPT));

    expect(onAccept.mock.calls[0][0].val.due_by).toEqual(None);
  });

  it("keeps the form open after an accept the card survives, and Cancel closes it", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    renderCard(makeSuggestion(), RelationshipRole.Coach, { onAccept });

    await userEvent.click(screen.getByRole("button", EDIT));
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", ACCEPT));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("disables the coach in the coachee's assignee picker", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    renderCard(makeSuggestion({ assignees: [COACHEE_ID] }), RelationshipRole.Coachee, { onAccept });

    await userEvent.click(screen.getByRole("button", EDIT));
    await userEvent.click(screen.getByRole("button", { name: "Assignees" }));
    const coach = await screen.findByRole("option", { name: /Jim Hodapp/ });
    expect(coach).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getAllByText("Only your coach can assign an action to themselves.").length
    ).toBeGreaterThan(0);
    await userEvent.click(coach);
    expect(coach).toHaveAttribute("aria-selected", "false");
  });
});

describe("ActionSectionContent review flow", () => {
  beforeEach(() => vi.clearAllMocks());

  function sectionProps(
    suggestions: ActionSuggestion[],
    sessionActions: Action[],
    handlers: {
      onSuggestionAccept?: (s: ActionSuggestion, e: Option<ActionEdits>) => Promise<Option<Action>>;
      onSuggestionDismiss?: (s: ActionSuggestion) => Promise<boolean>;
    }
  ) {
    return {
      reviewActions: [],
      sessionActions,
      actionSuggestions: suggestions,
      viewerRole: RelationshipRole.Coach,
      locale: "en-US",
      coachId: COACH_ID,
      coachName: "Jim Hodapp",
      coacheeId: COACHEE_ID,
      coacheeName: "Caleb Bourg",
      isAddingAction: false,
      onAddingActionChange: vi.fn(),
      onStatusChange: vi.fn(),
      onDueDateChange: vi.fn(),
      onAssigneesChange: vi.fn(),
      onBodyChange: vi.fn().mockResolvedValue(undefined),
      onActionCreate: vi.fn().mockResolvedValue(undefined),
      onActionDelete: vi.fn(),
      ...handlers,
    };
  }

  it("removes an accepted card and rings the new action once it arrives", async () => {
    // jsdom has no layout, so nothing scrolls on its own and centering falls back to the window.
    const scrollSpy = vi.spyOn(window, "scrollBy");
    const intoView = vi.spyOn(Element.prototype, "scrollIntoView");
    const created = createMockAction({ id: "act-new", body: "Send the hiring plan to Dana" });
    const onSuggestionAccept = vi.fn().mockResolvedValue(Some(created));
    const suggestion = makeSuggestion();
    const { rerender } = render(
      <Wrapper>
        <ActionSectionContent {...sectionProps([suggestion], [], { onSuggestionAccept })} />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", ACCEPT));
    expect(onSuggestionAccept).toHaveBeenCalledWith(suggestion, None);
    await waitFor(() =>
      expect(screen.queryByTestId("suggested-action-card")).not.toBeInTheDocument()
    );

    scrollSpy.mockClear();
    rerender(
      <Wrapper>
        <ActionSectionContent {...sectionProps([], [created], { onSuggestionAccept })} />
      </Wrapper>
    );
    await waitFor(() => expect(document.querySelector(".ring-2")).not.toBeNull());
    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    expect(intoView).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
    intoView.mockRestore();
  });

  it("keeps the card when the accept fails", async () => {
    const onSuggestionAccept = vi.fn().mockResolvedValue(None);
    render(
      <Wrapper>
        <ActionSectionContent {...sectionProps([makeSuggestion()], [], { onSuggestionAccept })} />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", ACCEPT));
    await waitFor(() => expect(onSuggestionAccept).toHaveBeenCalled());
    const card = screen.getByTestId("suggested-action-card");
    expect(card.closest(".animate-kanban-card-exit")).toBeNull();
    expect(within(card).getByRole("button", ACCEPT)).toBeEnabled();
  });

  it("removes a dismissed card", async () => {
    const onSuggestionDismiss = vi.fn().mockResolvedValue(true);
    const suggestion = makeSuggestion();
    render(
      <Wrapper>
        <ActionSectionContent {...sectionProps([suggestion], [], { onSuggestionDismiss })} />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", DISMISS));
    expect(onSuggestionDismiss).toHaveBeenCalledWith(suggestion);
    await waitFor(() =>
      expect(screen.queryByTestId("suggested-action-card")).not.toBeInTheDocument()
    );
  });

  it("routes an edited accept to the accept handler", async () => {
    const onSuggestionAccept = vi.fn().mockResolvedValue(None);
    const suggestion = makeSuggestion();
    render(
      <Wrapper>
        <ActionSectionContent {...sectionProps([suggestion], [], { onSuggestionAccept })} />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", EDIT));
    await userEvent.click(screen.getByRole("button", ACCEPT));
    expect(onSuggestionAccept).toHaveBeenCalledWith(
      suggestion,
      Some(expect.objectContaining({ body: "Send the hiring plan to Dana" }))
    );
  });
});
