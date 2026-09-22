import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { err, ok } from "neverthrow";

import { TranscriptDownloadButton } from "@/components/ui/coaching-sessions/transcript-download-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TranscriptionApi } from "@/lib/api/transcriptions";
import { saveBlobAs } from "@/lib/download-file";
import type { DownloadScope } from "@/lib/transcript/speaker-roles";
import { None, Some } from "@/types/option";
import { SpeakerRole } from "@/types/transcription";

vi.mock("@/lib/api/transcriptions", () => ({
  TranscriptionApi: { downloadText: vi.fn() },
}));

vi.mock("@/lib/download-file", () => ({ saveBlobAs: vi.fn() }));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

function renderButton(scope: DownloadScope) {
  return render(
    <TooltipProvider>
      <TranscriptDownloadButton sessionId="s1" transcriptionId="t1" scope={scope} />
    </TooltipProvider>
  );
}

const ALL: DownloadScope = { kind: "all" };
const COACH: DownloadScope = {
  kind: "role",
  role: SpeakerRole.Coach,
  label: "Jim H",
};
const UNMAPPED: DownloadScope = { kind: "unmapped", label: "Speaker A" };

describe("TranscriptDownloadButton — enabled states", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is enabled and labelled for download on the unfiltered scope", () => {
    renderButton(ALL);
    const button = screen.getByRole("button", { name: "Download transcript" });
    expect(button).toHaveAttribute("aria-disabled", "false");
  });

  it("names the filtered speaker in the label, so the control says what it produces", () => {
    renderButton(COACH);
    expect(
      screen.getByRole("button", { name: "Download Jim H's transcript" })
    ).toHaveAttribute("aria-disabled", "false");
  });
});

describe("TranscriptDownloadButton — availability", () => {
  // Maximize and close are desktop-only and both have mobile equivalents
  // elsewhere. Download has none, so hiding it would make the feature
  // unreachable on a phone.
  it("stays visible below the md breakpoint", () => {
    renderButton(ALL);
    expect(screen.getByRole("button")).not.toHaveClass("hidden");
  });
});

describe("TranscriptDownloadButton — blocked states", () => {
  beforeEach(() => vi.clearAllMocks());

  // aria-disabled rather than the disabled attribute, so the tooltip that
  // explains why can still open on hover.
  it("blocks an unmapped label", () => {
    renderButton(UNMAPPED);
    const button = screen.getByRole("button", { name: "Download transcript" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });

  it("blocks while the speakers list is unavailable", () => {
    renderButton({ kind: "speakers-unavailable" });
    expect(
      screen.getByRole("button", { name: "Download transcript" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  // The reason belongs in the tooltip, not the accessible name: a screen
  // reader hearing only "Switch to All to download" has no idea which control
  // it is on, while a sighted user still sees the download icon.
  it("keeps naming the action when blocked, and explains in the tooltip", async () => {
    const user = userEvent.setup();
    renderButton(UNMAPPED);

    const button = screen.getByRole("button", { name: "Download transcript" });
    await user.hover(button);

    expect(
      await screen.findByText("Switch to All to download")
    ).toBeInTheDocument();
  });

  it("does not fetch when clicked while blocked", () => {
    renderButton(UNMAPPED);
    fireEvent.click(screen.getByRole("button", { name: "Download transcript" }));
    expect(TranscriptionApi.downloadText).not.toHaveBeenCalled();
  });
});

describe("TranscriptDownloadButton — downloading", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the scope through and saves the returned file", async () => {
    const blob = new Blob(["transcript"]);
    vi.mocked(TranscriptionApi.downloadText).mockResolvedValue(
      ok({ blob, filename: "transcript-2026-09-21-filtered.txt" })
    );

    renderButton(COACH);
    fireEvent.click(
      screen.getByRole("button", { name: "Download Jim H's transcript" })
    );

    await waitFor(() => {
      expect(TranscriptionApi.downloadText).toHaveBeenCalledWith("s1", "t1", COACH);
      expect(saveBlobAs).toHaveBeenCalledWith(
        blob,
        "transcript-2026-09-21-filtered.txt"
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("TranscriptDownloadButton — failure messages", () => {
  beforeEach(() => vi.clearAllMocks());

  async function clickWith(failure: {
    status: ReturnType<typeof Some<number>> | typeof None;
    slug: ReturnType<typeof Some<string>> | typeof None;
  }) {
    vi.mocked(TranscriptionApi.downloadText).mockResolvedValue(err(failure));
    renderButton(ALL);
    fireEvent.click(screen.getByRole("button", { name: "Download transcript" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    return toastError.mock.calls[0][1] as { description: string };
  }

  it("never silently downloads everything when a role could not be identified", async () => {
    const body = await clickWith({
      status: Some(422),
      slug: Some("speaker_not_identified"),
    });
    expect(saveBlobAs).not.toHaveBeenCalled();
    expect(body.description).toMatch(/Switch to All/i);
  });

  it("explains a transcript that is still processing", async () => {
    const body = await clickWith({
      status: Some(409),
      slug: Some("transcription_not_completed"),
    });
    expect(body.description).toMatch(/still being prepared/i);
  });

  it("explains a missing transcript", async () => {
    const body = await clickWith({
      status: Some(404),
      slug: Some("transcription_not_found"),
    });
    expect(body.description).toMatch(/no longer available/i);
  });

  it("explains a forbidden transcript from the status alone", async () => {
    const body = await clickWith({ status: Some(403), slug: None });
    expect(body.description).toMatch(/do not have access/i);
  });

  it("falls back to generic copy for an unrecognized failure", async () => {
    const body = await clickWith({ status: None, slug: None });
    expect(body.description).toMatch(/something went wrong/i);
  });

  it("keeps technical detail out of every message", async () => {
    const body = await clickWith({
      status: Some(422),
      slug: Some("speaker_not_identified"),
    });
    expect(body.description).not.toMatch(/422|speaker_not_identified|coach/);
  });
});
