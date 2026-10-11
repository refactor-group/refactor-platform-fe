// Frozen acceptance test for fe#477 phase 5: jumping from a suggestion's quote
// to its transcript segment.

import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TranscriptPanel } from "@/components/ui/coaching-sessions/transcript-panel";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { SpeakerRole, type TranscriptSegment } from "@/types/transcription";
import { Some, None } from "@/types/option";
import { createMockAction } from "../../../test-utils";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

vi.mock("@/lib/api/meeting-recordings", () => ({
  useMeetingRecording: () => ({ recording: null, isLoading: false, isError: undefined }),
}));

const segment = (id: string, role: SpeakerRole, text: string, startMs: number): TranscriptSegment => ({
  id,
  transcription_id: "tx-1",
  speaker_label: role === SpeakerRole.Coach ? "Jim Hodapp" : "Caleb Bourg",
  speaker_user_id: Some(role === SpeakerRole.Coach ? "coach-1" : "coachee-1"),
  speaker_role: Some(role),
  text,
  start_ms: startMs,
  end_ms: startMs + 4000,
  created_at: "2026-10-11T15:00:00Z",
});

const SEGMENTS = [
  segment("seg-1", SpeakerRole.Coach, "How did the week go?", 1000),
  segment("seg-2", SpeakerRole.Coachee, "I should get time with Dana by end of next week.", 81000),
  segment("seg-3", SpeakerRole.Coach, "Sounds good.", 90000),
];

vi.mock("@/lib/api/transcriptions", () => ({
  useTranscription: () => ({
    transcription: {
      id: "tx-1",
      coaching_session_id: "s-1",
      meeting_recording_id: "rec-1",
      external_id: "ext",
      status: "completed",
      created_at: "2026-10-11T15:00:00Z",
      updated_at: "2026-10-11T15:00:00Z",
    },
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
  useTranscriptionSegments: () => ({
    segments: SEGMENTS,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
  TranscriptionApi: { downloadText: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

function renderPanel(jumpTo: Parameters<typeof TranscriptPanel>[0]["jumpTo"]) {
  return render(
    <Wrapper>
      <TranscriptPanel
        sessionId="s-1"
        meetingUrl={undefined}
        isMaximized={false}
        onToggleMaximize={vi.fn()}
        onClose={vi.fn()}
        jumpTo={jumpTo}
      />
    </Wrapper>
  );
}

describe("TranscriptPanel jump", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tags every segment with its id", () => {
    renderPanel(None);
    for (const s of SEGMENTS) {
      expect(document.querySelector(`[data-segment-id="${s.id}"]`)).not.toBeNull();
    }
  });

  it("centers and marks the requested segment", async () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
    renderPanel(Some({ segmentId: "seg-2", nonce: 1 }));

    const target = document.querySelector('[data-segment-id="seg-2"]') as HTMLElement;
    await waitFor(() => expect(within(target).getByTestId("transcript-jump-mark")).toBeInTheDocument());
    const mark = within(target).getByTestId("transcript-jump-mark");
    expect(mark.tagName).toBe("MARK");
    expect(mark).toHaveTextContent("I should get time with Dana by end of next week.");
    expect(mark.className).toContain("bg-amber-300");
    expect(scrollSpy.mock.contexts).toContain(target);
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
    expect(document.querySelectorAll('[data-testid="transcript-jump-mark"]')).toHaveLength(1);
    scrollSpy.mockRestore();
  });

  it("says so when the segment is not in this transcript", async () => {
    renderPanel(Some({ segmentId: "seg-404", nonce: 1 }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("That part of the transcript isn't available.")
    );
    expect(screen.queryByTestId("transcript-jump-mark")).not.toBeInTheDocument();
  });
});

describe("SuggestedActionCard quote link", () => {
  it("asks to show its segment in the transcript", async () => {
    const onShowInTranscript = vi.fn();
    const suggestion: ActionSuggestion = {
      id: "sug-1",
      coaching_session_id: "s-1",
      proposal: { ...createMockAction({ assignee_ids: ["coachee-1"] }), due_phrase: None },
      quote: "I should get time with Dana by end of next week.",
      segment: {
        id: "seg-2",
        start_ms: 81000,
        speaker_role: Some(SpeakerRole.Coachee),
        speaker_label: "Caleb Bourg",
      },
      duplicate_of: None,
      default_due: { at: DateTime.now(), source: DueSource.NextSession },
      created_at: DateTime.now(),
      resolved_by: None,
      resolved_at: None,
    };
    render(
      <Wrapper>
        <SuggestedActionCard
          suggestion={suggestion}
          viewerRole={RelationshipRole.Coach}
          locale="en-US"
          coachId="coach-1"
          coachName="Jim Hodapp"
          coacheeId="coachee-1"
          coacheeName="Caleb Bourg"
          onShowInTranscript={onShowInTranscript}
        />
      </Wrapper>
    );
    await userEvent.click(screen.getByRole("button", { name: /Show in transcript/ }));
    expect(onShowInTranscript).toHaveBeenCalledWith("seg-2");
  });
});
