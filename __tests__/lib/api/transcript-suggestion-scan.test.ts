// Frozen acceptance test for fe#477 phase 10: reading and starting a transcript scan.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TranscriptSuggestionApi,
  scanStatusUrl,
} from "@/lib/api/transcript-suggestions";
import { sessionGuard } from "@/lib/auth/session-guard";
import { ScanStatus } from "@/types/transcript-suggestion";
import { Some, None } from "@/types/option";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const SCAN = "http://localhost:3000/coaching_sessions/s-1/transcript_suggestions/scan";

const httpError = (status: number, data: unknown = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, statusText: "", data, headers: {}, config: {} },
  });

describe("scan status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is read from the session's scan route for actions", async () => {
    expect(scanStatusUrl("s-1")).toBe(`${SCAN}?target=action`);
    vi.mocked(sessionGuard.get).mockResolvedValue({
      data: { status_code: 200, data: { status: "completed" } },
    });

    expect(await TranscriptSuggestionApi.scanStatus("s-1")).toBe(ScanStatus.Completed);
    expect(vi.mocked(sessionGuard.get).mock.calls[0][0]).toBe(`${SCAN}?target=action`);
  });

  it("knows every status the backend sends", async () => {
    for (const [wire, status] of [
      ["unavailable", ScanStatus.Unavailable],
      ["none", ScanStatus.None],
      ["pending", ScanStatus.Pending],
      ["processing", ScanStatus.Processing],
      ["completed", ScanStatus.Completed],
      ["failed", ScanStatus.Failed],
    ] as const) {
      vi.mocked(sessionGuard.get).mockResolvedValue({
        data: { status_code: 200, data: { status: wire } },
      });
      expect(await TranscriptSuggestionApi.scanStatus("s-1")).toBe(status);
    }
  });

  it("throws on a status it does not know", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue({
      data: { status_code: 200, data: { status: "exploded" } },
    });
    await expect(TranscriptSuggestionApi.scanStatus("s-1")).rejects.toThrow();
  });
});

describe("starting a scan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs to the scan route with no body and returns the new status", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({
      status: 202,
      data: { status_code: 202, data: { status: "pending" } },
    });

    const result = await TranscriptSuggestionApi.startScan("s-1");

    expect(vi.mocked(sessionGuard.post).mock.calls[0]).toEqual([`${SCAN}?target=action`]);
    expect(result.isOk() && result.value).toBe(ScanStatus.Pending);
  });

  it("returns the backend's reason when the scan is refused", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(
      httpError(409, {
        error: "conflict",
        message: "Transcript already scanned for actions.",
      })
    );

    const result = await TranscriptSuggestionApi.startScan("s-1");

    expect(result.isErr() && result.error).toEqual({
      kind: "refused",
      message: Some("Transcript already scanned for actions."),
    });
  });

  it("treats a 422 as refused too, and a missing message as None", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(422, "plain text"));
    const result = await TranscriptSuggestionApi.startScan("s-1");
    expect(result.isErr() && result.error).toEqual({ kind: "refused", message: None });
  });

  it("reports a lost connection as network", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(
      Object.assign(new Error("Network Error"), { isAxiosError: true, response: undefined })
    );
    const result = await TranscriptSuggestionApi.startScan("s-1");
    expect(result.isErr() && result.error).toEqual({ kind: "network" });
  });
});
