// Frozen acceptance test for fe#477 phase 4b: the session's dismissed
// suggestions, the wire fields behind them, and restoring one.

import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import {
  TranscriptSuggestionApi,
  dismissedActionSuggestionsUrl,
} from "@/lib/api/transcript-suggestions";
import { sessionGuard } from "@/lib/auth/session-guard";
import { RelationshipRole } from "@/types/relationship-role";
import {
  DueSource,
  SuggestionStatus,
  parseActionSuggestion,
  type ActionSuggestion,
} from "@/types/transcript-suggestion";
import { Some, None } from "@/types/option";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { createMockAction } from "../../../test-utils";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const BASE = "http://localhost:3000/coaching_sessions/s-1/transcript_suggestions";
const COACH_ID = "coach-1";
const COACHEE_ID = "coachee-1";
const noon = (isoDate: string) => DateTime.fromISO(`${isoDate}T12:00:00Z`);

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const wire = (extra: Record<string, unknown>) => ({
  id: "sug-1",
  coaching_session_id: "s-1",
  proposal: {
    id: "00000000-0000-0000-0000-000000000000",
    coaching_session_id: "s-1",
    goal_id: null,
    body: "Try blocking two review-free mornings",
    user_id: COACH_ID,
    status: "NotStarted",
    status_changed_at: "2026-10-11T15:00:00Z",
    due_by: null,
    created_at: "2026-10-11T15:00:00Z",
    updated_at: "2026-10-11T15:00:00Z",
    assignee_ids: [COACHEE_ID],
    due_phrase: null,
  },
  quote: "What if you just blocked two mornings a week?",
  segment: { id: "seg-1", start_ms: 122000, speaker_role: "coach", speaker_label: "Jim Hodapp" },
  duplicate_of: null,
  default_due: { at: "2026-10-18T15:00:00Z", source: "next_session" },
  created_at: "2026-10-11T15:05:00Z",
  ...extra,
});

describe("resolved fields on the wire", () => {
  it("parses who resolved a suggestion and when", () => {
    const s = parseActionSuggestion(
      wire({ resolved_by: COACHEE_ID, resolved_at: "2026-10-11T16:00:00Z" })
    );
    expect(s.resolved_by).toEqual(Some(COACHEE_ID));
    expect(s.resolved_at.some && s.resolved_at.val.toUTC().toISO()).toBe(
      "2026-10-11T16:00:00.000Z"
    );
  });

  it("treats null or absent resolved fields as None", () => {
    expect(parseActionSuggestion(wire({ resolved_by: null, resolved_at: null })).resolved_by).toEqual(
      None
    );
    const absent = parseActionSuggestion(wire({}));
    expect(absent.resolved_by).toEqual(None);
    expect(absent.resolved_at).toEqual(None);
  });
});

describe("listing dismissed suggestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for the dismissed status", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue({ data: { status_code: 200, data: [] } });
    await TranscriptSuggestionApi.listActions("s-1", SuggestionStatus.Dismissed);
    expect(vi.mocked(sessionGuard.get).mock.calls[0][0]).toBe(
      `${BASE}?target=action&status=dismissed`
    );
    expect(dismissedActionSuggestionsUrl("s-1")).toBe(`${BASE}?target=action&status=dismissed`);
  });
});

function dismissed(id: Id, body: string, assignees: Id[], resolvedBy: Id): ActionSuggestion {
  return {
    id,
    coaching_session_id: "s-1",
    proposal: {
      ...createMockAction({ body, due_by: None, assignee_ids: assignees }),
      due_phrase: None,
    },
    quote: `Quote for ${body}`,
    segment: { id: "seg-1", start_ms: 122000, speaker_role: None, speaker_label: "Jim Hodapp" },
    duplicate_of: None,
    default_due: { at: noon("2026-10-18"), source: DueSource.NextSession },
    created_at: noon("2026-10-11"),
    resolved_by: Some(resolvedBy),
    resolved_at: Some(noon("2026-10-11")),
  };
}

const BY_COACHEE = dismissed("d-1", "Try blocking two review-free mornings", [COACHEE_ID], COACHEE_ID);
const BY_COACH = dismissed("d-2", "Send Caleb the tracking template", [COACH_ID], COACH_ID);

function renderSection(
  dismissedSuggestions: ActionSuggestion[],
  viewerRole: RelationshipRole,
  onSuggestionRestore = vi.fn().mockResolvedValue(true)
) {
  render(
    <Wrapper>
      <ActionSectionContent
        reviewActions={[]}
        sessionActions={[createMockAction({ id: "a-1", body: "Existing session action" }) as Action]}
        actionSuggestions={[]}
        dismissedSuggestions={dismissedSuggestions}
        viewerRole={viewerRole}
        locale="en-US"
        coachId={COACH_ID}
        coachName="Jim Hodapp"
        coacheeId={COACHEE_ID}
        coacheeName="Caleb Bourg"
        isAddingAction={false}
        onAddingActionChange={vi.fn()}
        onStatusChange={vi.fn()}
        onDueDateChange={vi.fn()}
        onAssigneesChange={vi.fn()}
        onBodyChange={vi.fn().mockResolvedValue(undefined)}
        onActionCreate={vi.fn().mockResolvedValue(undefined)}
        onActionDelete={vi.fn()}
        onSuggestionRestore={onSuggestionRestore}
      />
    </Wrapper>
  );
  return { onSuggestionRestore };
}

describe("the Dismissed section", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is hidden when nothing was dismissed", () => {
    renderSection([], RelationshipRole.Coach);
    expect(screen.queryByRole("button", { name: /Dismissed \(/ })).not.toBeInTheDocument();
  });

  it("starts collapsed above the session's actions and expands on click", async () => {
    renderSection([BY_COACHEE, BY_COACH], RelationshipRole.Coach);
    const toggle = screen.getByRole("button", { name: "Dismissed (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Try blocking two review-free mornings")).not.toBeInTheDocument();
    const existing = screen.getAllByText("Existing session action")[0];
    expect(toggle.compareDocumentPosition(existing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("dismissed-suggestion")).toHaveLength(2);
  });

  it("says who dismissed each one, naming the viewer as you", async () => {
    renderSection([BY_COACHEE, BY_COACH], RelationshipRole.Coach);
    await userEvent.click(screen.getByRole("button", { name: "Dismissed (2)" }));
    const [first, second] = screen.getAllByTestId("dismissed-suggestion");
    expect(first).toHaveTextContent("Try blocking two review-free mornings");
    expect(first).toHaveTextContent("Dismissed by Caleb · Oct 11");
    expect(second).toHaveTextContent("Dismissed by you · Oct 11");
  });

  it("restores a suggestion the viewer may act on", async () => {
    const { onSuggestionRestore } = renderSection([BY_COACHEE], RelationshipRole.Coach);
    await userEvent.click(screen.getByRole("button", { name: "Dismissed (1)" }));
    await userEvent.click(
      within(screen.getByTestId("dismissed-suggestion")).getByRole("button", { name: /Restore/ })
    );
    expect(onSuggestionRestore).toHaveBeenCalledWith(BY_COACHEE);
  });

  it("locks restore of a coach-only suggestion for the coachee", async () => {
    renderSection([BY_COACH], RelationshipRole.Coachee);
    await userEvent.click(screen.getByRole("button", { name: "Dismissed (1)" }));
    const row = screen.getByTestId("dismissed-suggestion");
    expect(within(row).queryByRole("button", { name: /Restore/ })).not.toBeInTheDocument();
    expect(row).toHaveTextContent("Only Jim can restore it");
    expect(row).toHaveTextContent("Dismissed by Jim · Oct 11");
  });
});
