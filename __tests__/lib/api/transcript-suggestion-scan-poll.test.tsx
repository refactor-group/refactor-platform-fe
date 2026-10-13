// A running scan is re-read on a timer, in case its finishing event never arrives.

import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SCAN_POLL_MS,
  TranscriptSuggestionApi,
  scanPollInterval,
  useActionSuggestionList,
  useScanStatus,
} from "@/lib/api/transcript-suggestions";
import { ScanStatus } from "@/types/transcript-suggestion";

describe("scanPollInterval", () => {
  it("polls only while a scan is queued or running", () => {
    expect(scanPollInterval(ScanStatus.Pending)).toBe(SCAN_POLL_MS);
    expect(scanPollInterval(ScanStatus.Processing)).toBe(SCAN_POLL_MS);
    for (const settled of [
      ScanStatus.Unavailable,
      ScanStatus.None,
      ScanStatus.Completed,
      ScanStatus.Failed,
    ]) {
      expect(scanPollInterval(settled)).toBe(0);
    }
  });
});

describe("useScanStatus polling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls a running scan even when it came from the cache with no request", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const read = vi
      .spyOn(TranscriptSuggestionApi, "scanStatus")
      .mockResolvedValue(ScanStatus.Processing);
    const Probe = ({ name }: { name: string }) => {
      const { status } = useScanStatus("s-1");
      return <span data-testid={name}>{status.some ? status.val : "none"}</span>;
    };
    const tree = (showFirst: boolean, showSecond: boolean) => (
      <SWRConfig value={{ provider: () => new Map() }}>
        {showFirst && <Probe name="first" />}
        {showSecond && <Probe name="second" />}
      </SWRConfig>
    );

    const { rerender } = render(tree(true, false));
    await waitFor(() => expect(screen.getByTestId("first")).toHaveTextContent("processing"));
    // Mounted inside SWR's dedupe window: served from the cache, so it makes no request.
    rerender(tree(true, true));
    expect(screen.getByTestId("second")).toHaveTextContent("processing");
    rerender(tree(false, true));
    expect(read).toHaveBeenCalledTimes(1);

    read.mockResolvedValue(ScanStatus.Completed);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_POLL_MS + 1_000);
    });

    await waitFor(() => expect(screen.getByTestId("second")).toHaveTextContent("completed"));
    expect(read.mock.calls.length).toBeGreaterThan(1);
  });

  it("re-reads the suggestion lists when a polled scan finishes, with no server event", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(TranscriptSuggestionApi, "scanStatus").mockResolvedValue(ScanStatus.Processing);
    const list = vi.spyOn(TranscriptSuggestionApi, "listActions").mockResolvedValue([]);
    const Probe = () => {
      const { status } = useScanStatus("s-1");
      useActionSuggestionList("s-1");
      return <span data-testid="scan">{status.some ? status.val : "none"}</span>;
    };

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Probe />
      </SWRConfig>
    );
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("processing"));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    vi.mocked(TranscriptSuggestionApi.scanStatus).mockResolvedValue(ScanStatus.Completed);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_POLL_MS + 1_000);
    });

    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("completed"));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
