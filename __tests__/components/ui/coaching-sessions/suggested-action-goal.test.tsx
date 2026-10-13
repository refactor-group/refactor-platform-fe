// Frozen acceptance test for fe#477 phase 9: linking a suggested action to a
// goal when accepting it, and refreshing goal progress afterwards.

import type { ReactNode } from "react";
import { render, renderHook, act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok } from "neverthrow";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { useSuggestionReview } from "@/lib/hooks/use-suggestion-review";
import { TranscriptSuggestionApi } from "@/lib/api/transcript-suggestions";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None, type Option } from "@/types/option";
import type { Id } from "@/types/general";
import { createMockAction, createMockGoal } from "../../../test-utils";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

vi.mock("@/lib/api/transcript-suggestions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/transcript-suggestions")>(
    "@/lib/api/transcript-suggestions"
  );
  return {
    ...actual,
    TranscriptSuggestionApi: { accept: vi.fn(), dismiss: vi.fn(), restore: vi.fn(), update: vi.fn() },
  };
});

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const GOAL = createMockGoal({ id: "goal-1", title: "Grow as a leader" });
const OTHER_GOAL = createMockGoal({ id: "goal-2", title: "Protect deep work" });
const people = {
  locale: "en-US",
  coachId: "coach-1",
  coachName: "Jim Hodapp",
  coacheeId: "coachee-1",
  coacheeName: "Caleb Bourg",
};

function makeSuggestion(goalId: Option<Id> = None): ActionSuggestion {
  return {
    id: "sug-1",
    coaching_session_id: "s-1",
    proposal: {
      ...createMockAction({ body: "Draft a delegation plan", assignee_ids: ["coachee-1"], goal_id: goalId }),
      due_phrase: None,
    },
    quote: "I'll put together a plan.",
    segment: { id: "seg-1", start_ms: 55000, speaker_role: None, speaker_label: "Caleb Bourg" },
    duplicate_of: None,
    default_due: { at: DateTime.now(), source: Some(DueSource.NextSession) },
    created_at: DateTime.now(),
    resolved_by: None,
    resolved_at: None,
  };
}

function goalRow() {
  const label = screen.getByText("Linked goal");
  return label.parentElement as HTMLElement;
}

describe("Linked goal on the suggestion edit form", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts with the picked goal", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <Wrapper>
        <SuggestedActionCard
          suggestion={makeSuggestion()}
          viewerRole={RelationshipRole.Coach}
          {...people}
          goals={[GOAL, OTHER_GOAL]}
          onAccept={onAccept}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(within(goalRow()).getByRole("button"));
    await userEvent.click(await screen.findByRole("option", { name: /Grow as a leader/ }));
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0].val.goal_id).toEqual(Some("goal-1"));
  });

  it("sends no goal when none is picked", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <Wrapper>
        <SuggestedActionCard
          suggestion={makeSuggestion()}
          viewerRole={RelationshipRole.Coach}
          {...people}
          goals={[GOAL]}
          onAccept={onAccept}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(within(goalRow()).getByRole("button")).toHaveTextContent("None");
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept.mock.calls[0][0].val.goal_id).toEqual(None);
  });

  it("starts from a goal already on the suggestion", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <Wrapper>
        <SuggestedActionCard
          suggestion={makeSuggestion(Some("goal-2"))}
          viewerRole={RelationshipRole.Coach}
          {...people}
          goals={[GOAL, OTHER_GOAL]}
          onAccept={onAccept}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(within(goalRow()).getByRole("button")).toHaveTextContent("Protect deep work");
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept.mock.calls[0][0].val.goal_id).toEqual(Some("goal-2"));
  });

  it("gets the session's goals from the Actions section", async () => {
    render(
      <Wrapper>
        <ActionSectionContent
          reviewActions={[]}
          sessionActions={[]}
          actionSuggestions={[makeSuggestion()]}
          viewerRole={RelationshipRole.Coach}
          {...people}
          goals={[GOAL]}
          isAddingAction={false}
          onAddingActionChange={vi.fn()}
          onStatusChange={vi.fn()}
          onDueDateChange={vi.fn()}
          onAssigneesChange={vi.fn()}
          onBodyChange={vi.fn().mockResolvedValue(undefined)}
          onSuggestionAccept={vi.fn().mockResolvedValue(None)}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Linked goal")).toBeInTheDocument();
  });
});

describe("goal progress after an accept", () => {
  beforeEach(() => vi.clearAllMocks());

  function setup() {
    const refreshGoalProgress = vi.fn();
    const { result } = renderHook(() =>
      useSuggestionReview({
        coachingSessionId: "s-1",
        refreshSuggestions: vi.fn(),
        refreshActions: vi.fn(),
        refreshGoalProgress,
      })
    );
    return { result, refreshGoalProgress };
  }

  it("refreshes goal progress when the new action is linked to a goal", async () => {
    vi.mocked(TranscriptSuggestionApi.accept).mockResolvedValue(
      ok(createMockAction({ id: "act-1", goal_id: Some("goal-1") }))
    );
    const { result, refreshGoalProgress } = setup();
    await act(async () => {
      await result.current.accept(makeSuggestion(), None);
    });
    expect(refreshGoalProgress).toHaveBeenCalledTimes(1);
  });

  it("leaves goal progress alone when the new action has no goal", async () => {
    vi.mocked(TranscriptSuggestionApi.accept).mockResolvedValue(
      ok(createMockAction({ id: "act-1", goal_id: None }))
    );
    const { result, refreshGoalProgress } = setup();
    await act(async () => {
      await result.current.accept(makeSuggestion(), None);
    });
    expect(refreshGoalProgress).not.toHaveBeenCalled();
  });
});
