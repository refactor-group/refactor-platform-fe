import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";

import { TranscriptBubble } from "@/components/ui/coaching-sessions/transcript-bubble";
import type { TranscriptSegment } from "@/types/transcription";
import type { BubbleGrouping } from "@/lib/transcript/group-bubbles";

function makeSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: "seg-1",
    transcription_id: "t-1",
    speaker_label: "Speaker A",
    text: "Hello, how are you?",
    start_ms: 23_000,
    end_ms: 26_000,
    created_at: DateTime.fromISO("2026-03-17T15:30:00.000Z"),
    ...overrides,
  };
}

function grouping(overrides: Partial<BubbleGrouping> = {}): BubbleGrouping {
  return { index: 0, isFirstOfGroup: true, isLastOfGroup: true, ...overrides };
}

describe("TranscriptBubble — header visibility", () => {
  it("renders the header when isFirstOfGroup", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping({ isFirstOfGroup: true })}
        alignment="left"
        variant="secondary"
      />
    );
    expect(screen.getByText("Speaker A")).toBeInTheDocument();
    expect(screen.getByText("0:23")).toBeInTheDocument();
  });

  it("hides the header when the bubble is mid-group", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping({ isFirstOfGroup: false, isLastOfGroup: false })}
        alignment="left"
        variant="secondary"
      />
    );
    expect(screen.queryByText("Speaker A")).not.toBeInTheDocument();
  });

  it("forces the header when forceHeader is true", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping({ isFirstOfGroup: false, isLastOfGroup: false })}
        alignment="left"
        variant="secondary"
        forceHeader
      />
    );
    expect(screen.getByText("Speaker A")).toBeInTheDocument();
  });

  it("prefers speakerDisplayName over raw speaker_label when provided", () => {
    render(
      <TranscriptBubble
        segment={makeSegment({ speaker_label: "Speaker A" })}
        grouping={grouping()}
        alignment="right"
        variant="primary"
        speakerDisplayName="Jim"
      />
    );
    expect(screen.getByText("Jim")).toBeInTheDocument();
    expect(screen.queryByText("Speaker A")).not.toBeInTheDocument();
  });
});

describe("TranscriptBubble — variant and tail corner", () => {
  it("applies iOS blue classes for primary", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping()}
        alignment="right"
        variant="primary"
      />
    );
    const body = screen.getByTestId("transcript-bubble-body");
    expect(body.className).toContain("bg-[#007AFF]");
    expect(body.className).toContain("text-white");
  });

  it("applies bordered light classes for secondary", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping()}
        alignment="left"
        variant="secondary"
      />
    );
    const body = screen.getByTestId("transcript-bubble-body");
    expect(body.className).toContain("bg-white");
    expect(body.className).toContain("border-zinc-200");
  });

  it("applies rounded-br tail when last in group and right-aligned", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping({ isLastOfGroup: true })}
        alignment="right"
        variant="primary"
      />
    );
    const body = screen.getByTestId("transcript-bubble-body");
    expect(body.className).toContain("rounded-br-[6px]");
  });

  it("applies rounded-bl tail when last in group and left-aligned", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping({ isLastOfGroup: true })}
        alignment="left"
        variant="secondary"
      />
    );
    const body = screen.getByTestId("transcript-bubble-body");
    expect(body.className).toContain("rounded-bl-[6px]");
  });

  it("omits the tail corner when not last of group", () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping({ isLastOfGroup: false })}
        alignment="right"
        variant="primary"
      />
    );
    const body = screen.getByTestId("transcript-bubble-body");
    expect(body.className).not.toContain("rounded-br-[6px]");
  });
});

describe("TranscriptBubble — text rendering", () => {
  it("renders the raw text by default", () => {
    render(
      <TranscriptBubble
        segment={makeSegment({ text: "What's the retention number?" })}
        grouping={grouping()}
        alignment="right"
        variant="primary"
      />
    );
    expect(screen.getByText("What's the retention number?")).toBeInTheDocument();
  });

  it("delegates to renderText when provided (highlighting hook)", () => {
    render(
      <TranscriptBubble
        segment={makeSegment({ text: "cohort retention" })}
        grouping={grouping()}
        alignment="right"
        variant="primary"
        renderText={(t) => <mark data-testid="custom">{t}</mark>}
      />
    );
    expect(screen.getByTestId("custom")).toHaveTextContent("cohort retention");
  });
});

describe("TranscriptBubble — copy button", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the segment text to the clipboard on click", async () => {
    render(
      <TranscriptBubble
        segment={makeSegment({ text: "verbatim text" })}
        grouping={grouping()}
        alignment="left"
        variant="secondary"
      />
    );

    const button = screen.getByRole("button", { name: /copy message/i });
    fireEvent.click(button);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("verbatim text"));
  });

  it("swaps to a Copied label after a successful copy and restores after the feedback window", async () => {
    render(
      <TranscriptBubble
        segment={makeSegment()}
        grouping={grouping()}
        alignment="left"
        variant="secondary"
      />
    );

    const button = screen.getByRole("button", { name: /copy message/i });
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument()
    );

    // Wait past the 1200ms feedback window. Long timeout so this is flake-proof.
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /copy message/i })
        ).toBeInTheDocument(),
      { timeout: 2_000 }
    );
  });
});
