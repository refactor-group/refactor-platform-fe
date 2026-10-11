// The edit form is read-only while the duplicate confirm row is open, so
// Add anyway always sends what the reviewer saw when pressing Accept.

import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionEdits, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None } from "@/types/option";
import { createMockAction } from "../../../test-utils";

const COACH_ID = "coach-1";
const COACHEE_ID = "coachee-1";
const noon = (isoDate: string) => DateTime.fromISO(`${isoDate}T12:00:00Z`);

const suggestion: ActionSuggestion = {
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
  duplicate_of: Some({ action_id: "act-3", body: Some("Plan the delegation") }),
  default_due: { at: noon("2026-10-18"), source: DueSource.NextSession },
  created_at: noon("2026-10-11"),
  resolved_by: None,
  resolved_at: None,
};

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

describe("the edit form while the duplicate confirm row is open", () => {
  it("locks the fields, sends the edits from Accept, and unlocks on Cancel", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <Wrapper>
        <SuggestedActionCard
          suggestion={suggestion}
          viewerRole={RelationshipRole.Coach}
          locale="en-US"
          coachId={COACH_ID}
          coachName="Jim Hodapp"
          coacheeId={COACHEE_ID}
          coacheeName="Caleb Bourg"
          onAccept={onAccept}
          onDismiss={vi.fn().mockResolvedValue(undefined)}
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textbox = screen.getByRole("textbox");
    await userEvent.clear(textbox);
    await userEvent.type(textbox, "Draft it anyway");
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(textbox).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Assignees" })).toBeDisabled();
    await userEvent.type(textbox, " later");
    expect(textbox).toHaveValue("Draft it anyway");

    const row = screen.getByTestId("suggested-action-duplicate-confirm");
    await userEvent.click(within(row).getByRole("button", { name: "Cancel" }));
    expect(textbox).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Assignees" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    await userEvent.click(
      within(screen.getByTestId("suggested-action-duplicate-confirm")).getByRole("button", {
        name: "Add anyway",
      })
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
    const edits: ActionEdits = onAccept.mock.calls[0][0].val;
    expect(edits.body).toBe("Draft it anyway");
    expect(edits.assignee_ids).toEqual([COACHEE_ID]);
  });
});
