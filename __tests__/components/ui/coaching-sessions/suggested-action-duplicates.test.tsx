// The possible-duplicate marker and confirm row, and undoing a dismiss from
// its toast.

import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None } from "@/types/option";
import type { Action } from "@/types/action";
import { createMockAction } from "../../../test-utils";
import { createMockActionSuggestion } from "../../../factories/action-suggestion.factory";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

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

function makeSuggestion(duplicateOf: { action_id: string; body: string } | null): ActionSuggestion {
  return createMockActionSuggestion({
    coaching_session_id: "s-1",
    proposal: {
      ...createMockAction({
        body: "Schedule a skip-level 1:1 with Dana",
        due_by: Some(noon("2026-10-16")),
        assignee_ids: [COACHEE_ID],
      }),
      due_phrase: None,
    },
    quote: "I should get time with Dana by end of next week.",
    segment: { id: "seg-4", start_ms: 81000, speaker_role: None, speaker_label: "Caleb Bourg" },
    duplicate_of: duplicateOf
      ? Some({ action_id: duplicateOf.action_id, body: Some(duplicateOf.body) })
      : None,
    default_due: { at: noon("2026-10-18"), source: Some(DueSource.NextSession) },
    created_at: noon("2026-10-11"),
  });
}

const DUP = { action_id: "act-3", body: "Set up skip-level meeting with Dana" };
const ACCEPT = { name: "Accept" };
const DISMISS = { name: "Dismiss" };
const EDIT = { name: "Edit" };
const CONFIRM_TEXT = "This looks like an action you already have:";

describe("possible duplicate on the card", () => {
  beforeEach(() => vi.clearAllMocks());

  function renderCard(suggestion: ActionSuggestion) {
    const handlers = {
      onAccept: vi.fn().mockResolvedValue(undefined),
      onDismiss: vi.fn().mockResolvedValue(undefined),
      onSave: vi.fn().mockResolvedValue(true),
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

  it("marks a possible duplicate and shows the existing action on click", async () => {
    const { onShowAction } = renderCard(makeSuggestion(DUP));
    const marker = screen.getByRole("button", { name: /Possible duplicate/ });
    expect(marker).toHaveAccessibleName(
      "Possible duplicate of: Set up skip-level meeting with Dana"
    );
    await userEvent.click(marker);
    expect(onShowAction).toHaveBeenCalledWith("act-3");
  });

  it("has no marker without a duplicate", () => {
    renderCard(makeSuggestion(null));
    expect(screen.queryByText("Possible duplicate")).not.toBeInTheDocument();
  });

  it("accepts a non-duplicate directly", async () => {
    const { onAccept } = renderCard(makeSuggestion(null));
    await userEvent.click(screen.getByRole("button", ACCEPT));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(CONFIRM_TEXT, { exact: false })).not.toBeInTheDocument();
  });

  it("asks before accepting a duplicate and offers Add anyway, Keep existing and Cancel", async () => {
    const { onAccept, onShowAction } = renderCard(makeSuggestion(DUP));
    await userEvent.click(screen.getByRole("button", ACCEPT));

    expect(onAccept).not.toHaveBeenCalled();
    const row = screen.getByTestId("suggested-action-duplicate-confirm");
    expect(row).toHaveTextContent(CONFIRM_TEXT);
    expect(row).toHaveTextContent("Set up skip-level meeting with Dana");
    expect(screen.queryByRole("button", ACCEPT)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", DISMISS)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", EDIT)).not.toBeInTheDocument();

    const names = within(row)
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    expect(names.slice(-3)).toEqual(["Add anyway", "Keep existing", "Cancel"]);

    await userEvent.click(within(row).getByRole("button", { name: /Set up skip-level/ }));
    expect(onShowAction).toHaveBeenCalledWith("act-3");

    await userEvent.click(within(row).getByRole("button", { name: "Add anyway" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing action by dismissing the suggestion", async () => {
    const { onDismiss, onAccept } = renderCard(makeSuggestion(DUP));
    await userEvent.click(screen.getByRole("button", ACCEPT));
    await userEvent.click(screen.getByRole("button", { name: "Keep existing" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("cancels the confirm with the button or Escape", async () => {
    renderCard(makeSuggestion(DUP));
    await userEvent.click(screen.getByRole("button", ACCEPT));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("suggested-action-duplicate-confirm")).not.toBeInTheDocument();
    expect(screen.getByRole("button", ACCEPT)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", ACCEPT));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("suggested-action-duplicate-confirm")).not.toBeInTheDocument();
  });
});

function sectionProps(over: Record<string, unknown>) {
  return {
    reviewActions: [] as Action[],
    sessionActions: [] as Action[],
    viewerRole: RelationshipRole.Coach,
    ...people,
    isAddingAction: false,
    onAddingActionChange: vi.fn(),
    onStatusChange: vi.fn(),
    onDueDateChange: vi.fn(),
    onAssigneesChange: vi.fn(),
    onBodyChange: vi.fn().mockResolvedValue(undefined),
    onActionCreate: vi.fn().mockResolvedValue(undefined),
    onActionDelete: vi.fn(),
    ...over,
  };
}

describe("ActionSectionContent duplicates and undo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches to the existing action's tab and rings it", async () => {
    const existing = createMockAction({ id: "act-3", body: "Set up skip-level meeting with Dana" });
    render(
      <Wrapper>
        <ActionSectionContent
          {...sectionProps({
            reviewActions: [existing],
            actionSuggestions: [makeSuggestion(DUP)],
          })}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: /Possible duplicate/ }));
    await waitFor(() =>
      expect(screen.getByTestId("action-tab-due")).toHaveAttribute("data-state", "active")
    );
    await waitFor(() => expect(document.querySelector(".ring-2")).not.toBeNull());
  });

  it("offers Undo after a dismiss, and Undo restores the card", async () => {
    const suggestion = makeSuggestion(null);
    const onSuggestionDismiss = vi.fn().mockResolvedValue(true);
    const onSuggestionRestore = vi.fn().mockResolvedValue(true);
    render(
      <Wrapper>
        <ActionSectionContent
          {...sectionProps({
            actionSuggestions: [suggestion],
            onSuggestionDismiss,
            onSuggestionRestore,
          })}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", DISMISS));
    await waitFor(() =>
      expect(screen.queryByTestId("suggested-action-card")).not.toBeInTheDocument()
    );

    expect(toast).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(toast).mock.calls[0] as unknown as [
      string,
      { description: string; duration: number; action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Dismissed suggested action");
    expect(options.description).toBe('"Schedule a skip-level 1:1 with Dana"');
    expect(options.duration).toBe(6000);
    expect(options.action.label).toBe("Undo");

    options.action.onClick();
    await waitFor(() => expect(onSuggestionRestore).toHaveBeenCalledWith(suggestion));
    expect(await screen.findByTestId("suggested-action-card")).toBeInTheDocument();
  });

  it("cuts a long action text short in the toast", async () => {
    const base = makeSuggestion(null);
    const long = {
      ...base,
      proposal: {
        ...base.proposal,
        body: "Write up the full delegation plan for the Q4 migration and share it with the team",
      },
    };
    render(
      <Wrapper>
        <ActionSectionContent
          {...sectionProps({
            actionSuggestions: [long],
            onSuggestionDismiss: vi.fn().mockResolvedValue(true),
            onSuggestionRestore: vi.fn().mockResolvedValue(true),
          })}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", DISMISS));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    const options = vi.mocked(toast).mock.calls[0][1] as unknown as { description: string };
    expect(options.description).toBe('"Write up the full delegation plan for th..."');
  });

  it("leaves the card dismissed when the restore fails", async () => {
    const suggestion = makeSuggestion(null);
    const onSuggestionRestore = vi.fn().mockResolvedValue(false);
    render(
      <Wrapper>
        <ActionSectionContent
          {...sectionProps({
            actionSuggestions: [suggestion],
            onSuggestionDismiss: vi.fn().mockResolvedValue(true),
            onSuggestionRestore,
          })}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", DISMISS));
    await waitFor(() =>
      expect(screen.queryByTestId("suggested-action-card")).not.toBeInTheDocument()
    );
    const options = vi.mocked(toast).mock.calls[0][1] as unknown as {
      action: { onClick: () => void };
    };
    options.action.onClick();
    await waitFor(() => expect(onSuggestionRestore).toHaveBeenCalled());
    expect(screen.queryByTestId("suggested-action-card")).not.toBeInTheDocument();
  });
});
