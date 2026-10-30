// A search in the transcript clears the quote's jump mark until the next jump.

import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TranscriptPanel } from "@/components/ui/coaching-sessions/transcript-panel";
import { SpeakerRole, type TranscriptSegment } from "@/types/transcription";
import { Some } from "@/types/option";

vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

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

describe("search clears the jump mark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no scrollBy; search scrolls its container to the active match.
    Element.prototype.scrollBy = vi.fn();
  });

  it("drops the quote mark once a search is typed", async () => {
    renderPanel(Some({ segmentId: "seg-2", nonce: 1 }));
    const target = document.querySelector('[data-segment-id="seg-2"]') as HTMLElement;
    expect(await within(target).findByTestId("transcript-jump-mark")).toBeInTheDocument();

    // The term is in another segment, so the quote has no search hit of its own.
    await userEvent.type(screen.getByRole("textbox", { name: "Search transcript" }), "Sounds");

    expect(screen.queryByTestId("transcript-jump-mark")).not.toBeInTheDocument();
    expect(screen.getAllByText("Sounds").some((el) => el.tagName === "MARK")).toBe(true);
  });

  it("stays cleared after the search is emptied, until the next jump", async () => {
    const { rerender } = renderPanel(Some({ segmentId: "seg-2", nonce: 1 }));
    const search = screen.getByRole("textbox", { name: "Search transcript" });
    await userEvent.type(search, "Sounds");
    await userEvent.clear(search);
    expect(screen.queryByTestId("transcript-jump-mark")).not.toBeInTheDocument();

    rerender(
      <Wrapper>
        <TranscriptPanel
          sessionId="s-1"
          meetingUrl={undefined}
          isMaximized={false}
          onToggleMaximize={vi.fn()}
          onClose={vi.fn()}
          jumpTo={Some({ segmentId: "seg-2", nonce: 2 })}
        />
      </Wrapper>
    );
    expect(await screen.findByTestId("transcript-jump-mark")).toBeInTheDocument();
  });
});
