import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TranscriptEmptyState } from "@/components/ui/coaching-sessions/transcript-empty-state";

describe("TranscriptEmptyState — no-meeting-url", () => {
  it("tells the user to set up a Google Meet link", () => {
    render(<TranscriptEmptyState variant={{ kind: "no-meeting-url" }} />);
    expect(screen.getByText("No meeting link set")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings → integrations/i })).toHaveAttribute(
      "href",
      "/settings/integrations"
    );
  });
});

describe("TranscriptEmptyState — no-recording", () => {
  it("renders a Start Recording CTA bound to the provided handler", () => {
    const onStart = vi.fn();
    render(
      <TranscriptEmptyState
        variant={{ kind: "no-recording", canStart: true, onStart }}
      />
    );
    const button = screen.getByRole("button", { name: /start recording/i });
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("disables the Start CTA when canStart is false", () => {
    render(
      <TranscriptEmptyState
        variant={{ kind: "no-recording", canStart: false, onStart: vi.fn() }}
      />
    );
    expect(screen.getByRole("button", { name: /start recording/i })).toBeDisabled();
  });
});

describe("TranscriptEmptyState — recording-live", () => {
  it("shows the formatted live duration and a Stop button", () => {
    const onStop = vi.fn();
    render(
      <TranscriptEmptyState
        variant={{ kind: "recording-live", durationMs: 125_000, onStop }}
      />
    );
    expect(
      screen.getByText(/Recording in progress/i)
    ).toBeInTheDocument();
    expect(screen.getByText("2:05")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe("TranscriptEmptyState — processing", () => {
  it("shows the generating-transcript loading message", () => {
    render(<TranscriptEmptyState variant={{ kind: "processing" }} />);
    expect(screen.getByText(/generating transcript/i)).toBeInTheDocument();
  });
});

describe("TranscriptEmptyState — recording-failed", () => {
  it("shows the title + error + Try Again button wired to onRetry", () => {
    const onRetry = vi.fn();
    render(
      <TranscriptEmptyState
        variant={{
          kind: "recording-failed",
          errorMessage: "Bot couldn't join the meeting",
          onRetry,
        }}
      />
    );
    expect(screen.getByText("Recording failed")).toBeInTheDocument();
    expect(screen.getByText("Bot couldn't join the meeting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the error message when none is provided", () => {
    render(
      <TranscriptEmptyState
        variant={{ kind: "recording-failed", onRetry: vi.fn() }}
      />
    );
    expect(screen.getByText("Recording failed")).toBeInTheDocument();
    expect(screen.queryByText(/.+ error/i)).not.toBeInTheDocument();
  });
});

describe("TranscriptEmptyState — transcription-failed", () => {
  it("shows a distinct title from recording-failed", () => {
    render(
      <TranscriptEmptyState
        variant={{ kind: "transcription-failed", onRetry: vi.fn() }}
      />
    );
    expect(screen.getByText("Transcript generation failed")).toBeInTheDocument();
  });
});
