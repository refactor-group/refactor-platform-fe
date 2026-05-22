import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { TranscriptEmptyState } from "@/components/ui/coaching-sessions/transcript-empty-state";

describe("TranscriptEmptyState — no-meeting-url", () => {
  it("tells the user to set up a Google Meet link", () => {
    render(<TranscriptEmptyState variant={{ kind: "no-meeting-url" }} />);
    expect(screen.getByText("No meeting link set")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /settings → integrations/i })
    ).toHaveAttribute("href", "/settings/integrations");
  });
});

describe("TranscriptEmptyState — no-recording", () => {
  it("directs the user to the Join Meeting button (no in-panel action)", () => {
    render(<TranscriptEmptyState variant={{ kind: "no-recording" }} />);
    expect(screen.getByText("No transcript yet")).toBeInTheDocument();
    expect(
      screen.getByText(/join meeting button/i)
    ).toBeInTheDocument();
    // Action moved to the header CTA — panel must not carry its own button.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TranscriptEmptyState — recording-live", () => {
  it("shows the formatted live duration with no in-panel Stop button", () => {
    render(
      <TranscriptEmptyState
        variant={{ kind: "recording-live", durationMs: 125_000 }}
      />
    );
    expect(screen.getByText(/transcription in progress/i)).toBeInTheDocument();
    expect(screen.getByText("2:05")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TranscriptEmptyState — processing", () => {
  it("shows the generating-transcript loading message", () => {
    render(<TranscriptEmptyState variant={{ kind: "processing" }} />);
    expect(screen.getByText(/generating transcript/i)).toBeInTheDocument();
  });
});

describe("TranscriptEmptyState — recording-failed", () => {
  it("shows the title + error and points to the toast for retry", () => {
    render(
      <TranscriptEmptyState
        variant={{
          kind: "recording-failed",
          errorMessage: "Bot couldn't join the meeting",
        }}
      />
    );
    expect(screen.getByText("Recording failed")).toBeInTheDocument();
    expect(
      screen.getByText("Bot couldn't join the meeting")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/notification for retry options/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("omits the error description when none is provided", () => {
    render(
      <TranscriptEmptyState variant={{ kind: "recording-failed" }} />
    );
    expect(screen.getByText("Recording failed")).toBeInTheDocument();
  });
});

describe("TranscriptEmptyState — transcription-failed", () => {
  it("shows a distinct title from recording-failed", () => {
    render(
      <TranscriptEmptyState variant={{ kind: "transcription-failed" }} />
    );
    expect(
      screen.getByText("Transcript generation failed")
    ).toBeInTheDocument();
  });
});

describe("TranscriptEmptyState — no-speech", () => {
  it("explains that no audio was captured", () => {
    render(<TranscriptEmptyState variant={{ kind: "no-speech" }} />);
    expect(screen.getByText("No speech detected")).toBeInTheDocument();
  });
});
