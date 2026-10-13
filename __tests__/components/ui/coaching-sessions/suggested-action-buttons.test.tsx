// Frozen acceptance test for fe#477 phase 7: one row of labelled buttons at the
// bottom of the card, and accepting with edits from the edit form.

import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionEdits, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None } from "@/types/option";
import { createMockAction } from "../../../test-utils";

const PICKED = DateTime.fromISO("2026-11-02T12:00:00Z");
vi.mock("@/components/ui/coaching-sessions/action-card-parts", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/ui/coaching-sessions/action-card-parts")
  >("@/components/ui/coaching-sessions/action-card-parts");
  return {
    ...actual,
    DueDatePicker: ({ onChange }: { value: DateTime; onChange: (date: DateTime) => void }) => (
      <button type="button" data-testid="mock-due-date-pick" onClick={() => onChange(PICKED)}>
        pick
      </button>
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

function makeSuggestion(duplicate = false): ActionSuggestion {
  return {
    id: "sug-1",
    coaching_session_id: "s-1",
    proposal: {
      ...createMockAction({
        body: "Draft a delegation plan",
        due_by: Some(noon("2026-10-21")),
        assignee_ids: [COACHEE_ID],
      }),
      due_phrase: None,
    },
    quote: "I'll put together a plan.",
    segment: { id: "seg-1", start_ms: 55000, speaker_role: None, speaker_label: "Caleb Bourg" },
    duplicate_of: duplicate
      ? Some({ action_id: "act-3", body: Some("Plan the delegation") })
      : None,
    default_due: { at: noon("2026-10-18"), source: Some(DueSource.NextSession) },
    created_at: noon("2026-10-11"),
    resolved_by: None,
    resolved_at: None,
  };
}

const labels = (container: HTMLElement) =>
  within(container)
    .getAllByRole("button")
    .map((b) => b.textContent?.trim());

function renderCard(suggestion: ActionSuggestion) {
  const handlers = {
    onAccept: vi.fn().mockResolvedValue(undefined),
    onDismiss: vi.fn().mockResolvedValue(undefined),
    onShowAction: vi.fn(),
  };
  render(
    <Wrapper>
      <SuggestedActionCard
        suggestion={suggestion}
        viewerRole={RelationshipRole.Coach}
        {...people}
        {...handlers}
      />
    </Wrapper>
  );
  return handlers;
}

describe("the card's button row", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ends the card with Accept, Edit and Dismiss, in that order", () => {
    renderCard(makeSuggestion());
    const card = screen.getByTestId("suggested-action-card");
    expect(labels(card).slice(-3)).toEqual(["Accept", "Edit", "Dismiss"]);
  });

  it("accepts as suggested from the row", async () => {
    const { onAccept } = renderCard(makeSuggestion());
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept).toHaveBeenCalledWith(None);
  });
});

describe("the edit form's button row", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ends with Accept and Cancel, and has no Save", async () => {
    renderCard(makeSuggestion());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const card = screen.getByTestId("suggested-action-card");
    expect(labels(card).slice(-2)).toEqual(["Accept", "Cancel"]);
    expect(within(card).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("opens with the edit form only, then returns to the card on Cancel", async () => {
    renderCard(makeSuggestion());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox")).toHaveValue("Draft a delegation plan");
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Linked goal")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("accepts with the edits in one step", async () => {
    const { onAccept } = renderCard(makeSuggestion());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textbox = screen.getByRole("textbox");
    await userEvent.clear(textbox);
    await userEvent.type(textbox, "Draft the revised plan");
    await userEvent.click(screen.getByTestId("mock-due-date-pick"));
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    const sent = onAccept.mock.calls[0][0];
    expect(sent.some).toBe(true);
    const edits: ActionEdits = sent.val;
    expect(edits.body).toBe("Draft the revised plan");
    expect(edits.due_by).toEqual(Some(PICKED));
    expect(edits.assignee_ids).toEqual([COACHEE_ID]);
  });

  it("disables Accept while the body is empty", async () => {
    renderCard(makeSuggestion());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByRole("textbox"));
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
  });

  it("asks about a possible duplicate and keeps the edits for Add anyway", async () => {
    const { onAccept } = renderCard(makeSuggestion(true));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textbox = screen.getByRole("textbox");
    await userEvent.clear(textbox);
    await userEvent.type(textbox, "Draft it anyway");
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).not.toHaveBeenCalled();
    const row = screen.getByTestId("suggested-action-duplicate-confirm");
    await userEvent.click(within(row).getByRole("button", { name: "Add anyway" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    const sent = onAccept.mock.calls[0][0];
    expect(sent.some && sent.val.body).toBe("Draft it anyway");
  });
});

describe("ActionSectionContent accept with edits", () => {
  it("passes the edits to the accept handler", async () => {
    const created = createMockAction({ id: "act-new" });
    const onSuggestionAccept = vi.fn().mockResolvedValue(Some(created));
    const suggestion = makeSuggestion();
    render(
      <Wrapper>
        <ActionSectionContent
          reviewActions={[]}
          sessionActions={[]}
          actionSuggestions={[suggestion]}
          viewerRole={RelationshipRole.Coach}
          {...people}
          isAddingAction={false}
          onAddingActionChange={vi.fn()}
          onStatusChange={vi.fn()}
          onDueDateChange={vi.fn()}
          onAssigneesChange={vi.fn()}
          onBodyChange={vi.fn().mockResolvedValue(undefined)}
          onActionCreate={vi.fn().mockResolvedValue(undefined)}
          onActionDelete={vi.fn()}
          onSuggestionAccept={onSuggestionAccept}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onSuggestionAccept).toHaveBeenCalledWith(
      suggestion,
      Some(expect.objectContaining({ body: "Draft a delegation plan" }))
    );
  });
});
