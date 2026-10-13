// A suggestion restored from the Dismissed section while its dismiss animation is still running
// comes back and stays.

import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { RelationshipRole } from "@/types/relationship-role";
import { Some, type Option } from "@/types/option";
import type { ActionSuggestion } from "@/types/transcript-suggestion";
import type { Id } from "@/types/general";
import { createMockAction } from "../../../test-utils";
import { createMockActionSuggestion } from "../../../factories/action-suggestion.factory";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const COACH_ID = "coach-1";
const BODY = "Send the hiring plan to Dana";

const pending = createMockActionSuggestion({
  id: "sug-plain",
  proposal: { ...createMockAction({ body: BODY, assignee_ids: [COACH_ID] }), due_phrase: Some("by Friday") as Option<string> },
});
const dismissed: ActionSuggestion = { ...pending, resolved_by: Some(COACH_ID) as Option<Id> };

function section(pendingList: ActionSuggestion[], dismissedList: ActionSuggestion[], handlers: object) {
  return (
    <TooltipProvider>
      <ActionSectionContent
        reviewActions={[]}
        sessionActions={[]}
        actionSuggestions={pendingList}
        dismissedSuggestions={dismissedList}
        viewerRole={RelationshipRole.Coach}
        locale="en-US"
        coachId={COACH_ID}
        coachName="Jim Hodapp"
        coacheeId="coachee-1"
        coacheeName="Caleb Bourg"
        isAddingAction={false}
        onAddingActionChange={vi.fn()}
        onStatusChange={vi.fn()}
        onDueDateChange={vi.fn()}
        onAssigneesChange={vi.fn()}
        onBodyChange={vi.fn().mockResolvedValue(undefined)}
        onActionCreate={vi.fn().mockResolvedValue(undefined)}
        onActionDelete={vi.fn()}
        {...handlers}
      />
    </TooltipProvider>
  );
}

describe("restoring a suggestion while its dismissal is still animating", () => {
  it("keeps the restored card on screen", async () => {
    const handlers = {
      onSuggestionDismiss: vi.fn().mockResolvedValue(true),
      onSuggestionRestore: vi.fn().mockResolvedValue(true),
    };
    const { rerender } = render(section([pending], [], handlers));

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    // The lists refetch: the card is now dismissed.
    rerender(section([], [dismissed], handlers));
    await userEvent.click(screen.getByRole("button", { name: "Dismissed (1)" }));
    await userEvent.click(screen.getByRole("button", { name: /Restore/ }));
    // The lists refetch again before the dismiss animation's 400 ms are up.
    rerender(section([pending], [], handlers));

    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(screen.getByTestId("suggested-action-card")).toHaveTextContent(BODY);
  });
});
