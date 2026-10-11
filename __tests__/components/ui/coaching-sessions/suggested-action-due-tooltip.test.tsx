// A tapped due-date tooltip closes on a second tap, Escape or a press elsewhere,
// and only one is open at a time.

import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None } from "@/types/option";
import { createMockAction } from "../../../test-utils";

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const noon = (isoDate: string) => DateTime.fromISO(`${isoDate}T12:00:00Z`);

function suggestion(id: string, phrase: string): ActionSuggestion {
  return {
    id,
    coaching_session_id: "s-1",
    proposal: {
      ...createMockAction({ id, body: `Body ${id}`, due_by: Some(noon("2026-10-16")), assignee_ids: [] }),
      due_phrase: Some(phrase),
    },
    quote: "q",
    segment: { id: `seg-${id}`, start_ms: 0, speaker_role: None, speaker_label: "Guest 1" },
    duplicate_of: None,
    default_due: { at: noon("2026-10-18"), source: DueSource.NextSession },
    created_at: noon("2026-10-11"),
    resolved_by: None,
    resolved_at: None,
  };
}

const FIRST = "Due Oct 16, 2026 · from “by Friday”";
const SECOND = "Due Oct 16, 2026 · from “end of week”";

function renderTwo() {
  render(
    <Wrapper>
      {[suggestion("a", "by Friday"), suggestion("b", "end of week")].map((s) => (
        <SuggestedActionCard
          key={s.id}
          suggestion={s}
          viewerRole={RelationshipRole.Coach}
          locale="en-US"
          coachId="coach-1"
          coachName="Jim Hodapp"
          coacheeId="coachee-1"
          coacheeName="Caleb Bourg"
        />
      ))}
      <p>outside</p>
    </Wrapper>
  );
  const [first, second] = screen.getAllByTestId("suggested-action-due");
  return { first, second };
}

const shown = (text: string) => screen.queryAllByText(text).length > 0;

describe("due-date tooltip on tap", () => {
  it("closes on a second tap of the same date", async () => {
    const { first } = renderTwo();
    await userEvent.click(first);
    await waitFor(() => expect(shown(FIRST)).toBe(true));
    await userEvent.click(first);
    await waitFor(() => expect(shown(FIRST)).toBe(false));
  });

  it("closes on Escape", async () => {
    const { first } = renderTwo();
    await userEvent.click(first);
    await waitFor(() => expect(shown(FIRST)).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(shown(FIRST)).toBe(false));
  });

  it("closes on a press elsewhere", async () => {
    const { first } = renderTwo();
    await userEvent.click(first);
    await waitFor(() => expect(shown(FIRST)).toBe(true));
    await userEvent.click(screen.getByText("outside"));
    await waitFor(() => expect(shown(FIRST)).toBe(false));
  });

  it("keeps only one open when another date is tapped", async () => {
    const { first, second } = renderTwo();
    await userEvent.click(first);
    await waitFor(() => expect(shown(FIRST)).toBe(true));
    await userEvent.click(second);
    await waitFor(() => expect(shown(SECOND)).toBe(true));
    expect(shown(FIRST)).toBe(false);
  });
});
