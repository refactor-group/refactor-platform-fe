import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { None } from "@/types/option";
import { createMockAction } from "../../../test-utils";

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const suggestion: ActionSuggestion = {
  id: "sug-1",
  coaching_session_id: "s-1",
  proposal: { ...createMockAction({ assignee_ids: ["coachee-1"] }), due_phrase: None },
  quote: "I'll book a one on one with my manager.",
  segment: { id: "seg-1", start_ms: 58000, speaker_role: None, speaker_label: "Jim H" },
  duplicate_of: None,
  default_due: { at: DateTime.now(), source: DueSource.NextSession },
  created_at: DateTime.now(),
  resolved_by: None,
  resolved_at: None,
};

function renderSection(actionSuggestions: ActionSuggestion[]) {
  render(
    <Wrapper>
      <ActionSectionContent
        reviewActions={[]}
        sessionActions={[]}
        actionSuggestions={actionSuggestions}
        viewerRole={RelationshipRole.Coach}
        locale="en-US"
        coachId="coach-1"
        coachName="Jim Hodapp"
        coacheeId="coachee-1"
        coacheeName="Caleb Bourg"
        isAddingAction={false}
        onAddingActionChange={vi.fn()}
        onStatusChange={vi.fn()}
        onDueDateChange={vi.fn()}
        onAssigneesChange={vi.fn()}
        onBodyChange={vi.fn().mockResolvedValue(undefined)}
      />
    </Wrapper>
  );
}

describe("New tab empty state with suggestions", () => {
  it("hides No actions yet while suggestions are pending", () => {
    renderSection([suggestion]);
    expect(screen.queryByText("No actions yet")).not.toBeInTheDocument();
  });

  it("shows No actions yet when there are neither actions nor suggestions", () => {
    renderSection([]);
    expect(screen.getByText("No actions yet")).toBeInTheDocument();
  });
});
