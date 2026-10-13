// The rescan button in the Actions panel, and the hook that starts a scan.

import type { ReactNode } from "react";
import { render, renderHook, act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "neverthrow";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuggestionScanButton } from "@/components/ui/coaching-sessions/suggestion-scan-button";
import { useSuggestionScan } from "@/lib/hooks/use-suggestion-scan";
import { TranscriptSuggestionApi } from "@/lib/api/transcript-suggestions";
import { ScanStatus } from "@/types/transcript-suggestion";
import { Some } from "@/types/option";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

vi.mock("@/lib/api/transcript-suggestions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/transcript-suggestions")>(
    "@/lib/api/transcript-suggestions"
  );
  return {
    ...actual,
    TranscriptSuggestionApi: { ...actual.TranscriptSuggestionApi, startScan: vi.fn(), scanStatus: vi.fn() },
  };
});

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const NAME = "Scan transcript for suggested actions";
const TIPS = {
  none: "Scan transcript for actions",
  failed: "Scan failed. Scan transcript again",
  scanning: "Scanning transcript for actions…",
  completed: "Transcript already scanned for actions",
};

function renderButton(status: ScanStatus) {
  const onStart = vi.fn();
  const view = render(
    <Wrapper>
      <SuggestionScanButton status={status} onStart={onStart} />
    </Wrapper>
  );
  return { onStart, view };
}

const tipShown = async (text: string) =>
  waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));

describe("SuggestionScanButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is hidden when a scan is not possible", () => {
    const { view } = renderButton(ScanStatus.Unavailable);
    expect(view.container).toBeEmptyDOMElement();
  });

  it("starts a scan when never scanned, and says what it does", async () => {
    const { onStart } = renderButton(ScanStatus.None);
    const button = screen.getByRole("button", { name: NAME });
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    await userEvent.hover(button);
    await tipShown(TIPS.none);
    await userEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("offers a retry after a failed scan", async () => {
    const { onStart } = renderButton(ScanStatus.Failed);
    const button = screen.getByRole("button", { name: NAME });
    await userEvent.hover(button);
    await tipShown(TIPS.failed);
    await userEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("is disabled and spinning while a scan is queued or running", async () => {
    for (const status of [ScanStatus.Pending, ScanStatus.Processing]) {
      const { onStart, view } = renderButton(status);
      const button = screen.getByRole("button", { name: NAME });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button.querySelector("svg")?.getAttribute("class")).toContain("animate-spin");
      await userEvent.click(button);
      expect(onStart).not.toHaveBeenCalled();
      await tipShown(TIPS.scanning);
      view.unmount();
    }
  });

  it("is disabled once suggested actions were made, and says so on a tap", async () => {
    const { onStart } = renderButton(ScanStatus.Completed);
    const button = screen.getByRole("button", { name: NAME });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.querySelector("svg")?.getAttribute("class") ?? "").not.toContain("animate-spin");
    await userEvent.click(button);
    expect(onStart).not.toHaveBeenCalled();
    await tipShown(TIPS.completed);
  });

  it("can still be focused when disabled, so keyboard and screen reader users get the reason", async () => {
    renderButton(ScanStatus.Completed);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: NAME })).toHaveFocus();
    await tipShown(TIPS.completed);
  });
});

describe("useSuggestionScan", () => {
  beforeEach(() => vi.clearAllMocks());

  function setup() {
    const refresh = vi.fn();
    const { result } = renderHook(() => useSuggestionScan("s-1", refresh));
    return { result, refresh };
  }

  it("starts the scan and refreshes the status", async () => {
    vi.mocked(TranscriptSuggestionApi.startScan).mockResolvedValue(ok(ScanStatus.Pending));
    const { result, refresh } = setup();

    await act(async () => {
      await result.current.start();
    });

    expect(TranscriptSuggestionApi.startScan).toHaveBeenCalledWith("s-1");
    expect(refresh).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the backend's reason when a scan is refused, and refreshes", async () => {
    vi.mocked(TranscriptSuggestionApi.startScan).mockResolvedValue(
      err({ kind: "refused", message: Some("A scan is already running.") })
    );
    const { result, refresh } = setup();

    await act(async () => {
      await result.current.start();
    });

    expect(toast.error).toHaveBeenCalledWith("A scan is already running.");
    expect(refresh).toHaveBeenCalled();
  });

  it("explains a lost connection", async () => {
    vi.mocked(TranscriptSuggestionApi.startScan).mockResolvedValue(err({ kind: "network" }));
    const { result } = setup();

    await act(async () => {
      await result.current.start();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't start the scan. Connection to service was lost."
    );
  });
});
