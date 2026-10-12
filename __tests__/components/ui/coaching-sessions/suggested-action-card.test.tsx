// Frozen acceptance test for fe#477 phase 2: the read-only suggested action
// card and its placement in the Actions panel's New tab.

import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { SpeakerRole } from "@/types/transcription";
import { Some, None } from "@/types/option";
import type { Id } from "@/types/general";
import { createMockAction } from "../../../test-utils";

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
  overrides: {
    id?: Id;
    body?: string;
    assignees?: Id[];
    dueBy?: DateTime | null;
    phrase?: string | null;
    source?: DueSource;
  } = {}
): ActionSuggestion {
  const dueBy = overrides.dueBy === undefined ? noon("2026-10-17") : overrides.dueBy;
  const phrase = overrides.phrase === undefined ? "by Friday" : overrides.phrase;
  return {
    id: overrides.id ?? "sug-1",
    coaching_session_id: "s-1",
    proposal: {
      ...createMockAction({
        id: "00000000-0000-0000-0000-000000000000",
        body: overrides.body ?? "Send the hiring plan to Dana",
        due_by: dueBy ? Some(dueBy) : None,
        assignee_ids: overrides.assignees ?? [COACHEE_ID],
      }),
      due_phrase: phrase ? Some(phrase) : None,
    },
    quote: "I'll send Dana the hiring plan by Friday.",
    segment: {
      id: "seg-9",
      start_ms: 754000,
      speaker_role: Some(SpeakerRole.Coachee),
      speaker_label: "Caleb Bourg",
    },
    duplicate_of: None,
    default_due: { at: noon("2026-10-18"), source: overrides.source ?? DueSource.NextSession },
    created_at: noon("2026-10-11"),
  };
}

const ACTION_BUTTONS = ["Accept", "Dismiss", "Edit"];

function renderCard(suggestion: ActionSuggestion, viewerRole: RelationshipRole) {
  return render(
    <Wrapper>
      <SuggestedActionCard suggestion={suggestion} viewerRole={viewerRole} {...people} />
    </Wrapper>
  );
}

describe("SuggestedActionCard", () => {
  it("renders the body, quote, source link, assignee and due date", () => {
    renderCard(makeSuggestion(), RelationshipRole.Coach);
    const card = screen.getByTestId("suggested-action-card");

    expect(within(card).getByText("Suggested")).toBeInTheDocument();
    expect(within(card).getByTestId("suggested-action-body")).toHaveTextContent(
      "Send the hiring plan to Dana"
    );
    const quote = card.querySelector("blockquote");
    expect(quote).toHaveTextContent(/^I'll send Dana the hiring plan by Friday\.$/);
    const link = within(card).getByRole("button", { name: /Show in transcript/ });
    expect(link).toHaveTextContent("Caleb Bourg · 12:34");
    expect(within(card).getByText("CB")).toBeInTheDocument();
    expect(within(card).getByTestId("suggested-action-due")).toHaveTextContent("Oct 17, 2026");
    expect(within(card).getByTestId("suggested-action-due")).toHaveAttribute(
      "data-due-kind",
      "spoken"
    );
  });

  it("gives the coach the accept, dismiss and edit controls and no lock note", () => {
    renderCard(makeSuggestion({ assignees: [COACH_ID] }), RelationshipRole.Coach);
    for (const name of ACTION_BUTTONS) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByTestId("suggested-action-lock-note")).not.toBeInTheDocument();
  });

  it("shows the coachee a lock note and no controls on a coach-only suggestion", () => {
    renderCard(makeSuggestion({ assignees: [COACH_ID] }), RelationshipRole.Coachee);
    for (const name of ACTION_BUTTONS) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByTestId("suggested-action-lock-note")).toHaveTextContent(
      "Only Jim can accept or edit this action."
    );
  });

  it("gives the coachee the controls on their own suggestion", () => {
    renderCard(makeSuggestion({ assignees: [COACHEE_ID] }), RelationshipRole.Coachee);
    for (const name of ACTION_BUTTONS) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByTestId("suggested-action-lock-note")).not.toBeInTheDocument();
  });

  it("says Unassigned when nobody is assigned", () => {
    renderCard(makeSuggestion({ assignees: [] }), RelationshipRole.Coach);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("opens the due phrase tooltip on tap", async () => {
    renderCard(makeSuggestion(), RelationshipRole.Coach);
    await userEvent.click(screen.getByTestId("suggested-action-due"));
    expect(
      (await screen.findAllByText("Due Oct 17, 2026 · from “by Friday”")).length
    ).toBeGreaterThan(0);
  });

  it("shows the default due date with its source when no date was spoken", async () => {
    renderCard(
      makeSuggestion({ dueBy: null, phrase: null, source: DueSource.SevenDays }),
      RelationshipRole.Coach
    );
    const due = screen.getByTestId("suggested-action-due");
    expect(due).toHaveTextContent("Oct 18, 2026");
    expect(due).toHaveAttribute("data-due-kind", "default");
    await userEvent.click(due);
    expect(
      (await screen.findAllByText("No date mentioned. Defaults to a week from today")).length
    ).toBeGreaterThan(0);
  });

  it("expands the clamped body on click", async () => {
    renderCard(makeSuggestion(), RelationshipRole.Coach);
    const body = screen.getByTestId("suggested-action-body");
    expect(body).toHaveAttribute("data-expanded", "false");
    await userEvent.click(body);
    expect(body).toHaveAttribute("data-expanded", "true");
  });
});

function sectionProps(suggestions: ActionSuggestion[], viewerRole = RelationshipRole.Coach) {
  return {
    reviewActions: [],
    sessionActions: [createMockAction({ id: "session-action-1", body: "Existing session action" })],
    actionSuggestions: suggestions,
    viewerRole,
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
  };
}

describe("ActionSectionContent with suggestions", () => {
  it("adds the suggested count to the New tab and lists the cards above the session's actions", () => {
    render(
      <Wrapper>
        <ActionSectionContent
          {...sectionProps([makeSuggestion({ id: "a" }), makeSuggestion({ id: "b" })])}
        />
      </Wrapper>
    );
    const tab = screen.getByTestId("action-tab-new");
    expect(tab.textContent).toContain("(1)");
    expect(tab.textContent).toContain("· 2 suggested");

    const heading = screen.getByText("Suggested from transcript");
    expect(screen.getAllByTestId("suggested-action-card")).toHaveLength(2);
    const existing = screen.getAllByText("Existing session action")[0];
    expect(
      heading.compareDocumentPosition(existing) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("counts suggestions the viewer can only read", () => {
    render(
      <Wrapper>
        <ActionSectionContent
          {...sectionProps([makeSuggestion({ assignees: [COACH_ID] })], RelationshipRole.Coachee)}
        />
      </Wrapper>
    );
    expect(screen.getByTestId("action-tab-new").textContent).toContain("· 1 suggested");
  });

  it("shows no count and no group when there are no suggestions", () => {
    render(
      <Wrapper>
        <ActionSectionContent {...sectionProps([])} />
      </Wrapper>
    );
    expect(screen.getByTestId("action-tab-new").textContent).not.toContain("suggested");
    expect(screen.queryByText("Suggested from transcript")).not.toBeInTheDocument();
    expect(screen.queryByTestId("suggested-action-card")).not.toBeInTheDocument();
  });

  it("still shows suggestions when the session's sections are locked", () => {
    render(
      <Wrapper>
        <ActionSectionContent {...{ ...sectionProps([makeSuggestion()]), readOnly: true }} />
      </Wrapper>
    );
    expect(screen.getByTestId("suggested-action-card")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Accept" })
    ).toBeInTheDocument();
  });
});
