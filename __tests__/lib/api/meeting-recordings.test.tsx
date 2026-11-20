import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { http, HttpResponse } from "msw";
import { server } from "@/test-utils/msw-server";
import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import { MeetingRecordingStatus, parseMeetingRecording } from "@/types/meeting-recording";
import { None, Some } from "@/types/option";

// A concrete base URL so msw can match the hook's real requests.
vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:4000", backendApiVersion: "1.0.0-test" } },
}));

const RECORDING_URL = "http://localhost:4000/coaching_sessions/s-1/meeting_recording";
const MEETING = "https://meet.google.com/abc-defg-hij";

const recording = (overrides: Record<string, unknown> = {}) => ({
  id: "r-1",
  coaching_session_id: "s-1",
  bot_id: "bot-1",
  status: MeetingRecordingStatus.Pending,
  created_at: "2026-11-18T00:00:00Z",
  updated_at: "2026-11-18T00:00:00Z",
  ...overrides,
});

// A fresh cache per test, so one test's answer never stands in for the next one's request.
const fresh = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);
const render = () => renderHook(() => useMeetingRecording("s-1"), { wrapper: fresh });

const ok = (data: unknown, status = 200) => HttpResponse.json({ status_code: status, data }, { status });

describe("parseMeetingRecording", () => {
  it("reads a bot id, or None for a claim whose bot isn't dispatched yet", () => {
    expect(parseMeetingRecording(recording()).bot_id).toEqual(Some("bot-1"));
    expect(parseMeetingRecording(recording({ bot_id: null })).bot_id).toEqual(None);
  });
});

describe("useMeetingRecording: startRecording", () => {
  it("returns the recording it started", async () => {
    server.use(
      http.get(RECORDING_URL, () => ok(null)),
      http.post(RECORDING_URL, () => ok(recording(), 201))
    );
    const { result } = render();
    const started = await result.current.startRecording(MEETING);
    expect(started.isOk() && started.value.kind).toBe("started");
  });

  it("treats the other participant's running recording as success, and reads it", async () => {
    let reads = 0;
    server.use(
      http.get(RECORDING_URL, () => {
        reads += 1;
        return ok(reads === 1 ? null : recording({ bot_id: null }));
      }),
      http.post(RECORDING_URL, () =>
        HttpResponse.json(
          { status_code: 409, error: "conflict", details: { reason: "recording_already_active" } },
          { status: 409 }
        )
      )
    );
    const { result } = render();
    await waitFor(() => expect(reads).toBe(1));

    const started = await result.current.startRecording(MEETING);
    expect(started.isOk() && started.value).toEqual({ kind: "already_active" });
    await waitFor(() => expect(result.current.recording?.status).toBe(MeetingRecordingStatus.Pending));
  });

  it("keeps any other refusal an error", async () => {
    server.use(
      http.get(RECORDING_URL, () => ok(null)),
      http.post(RECORDING_URL, () =>
        HttpResponse.json({ status_code: 409, error: "organization_archived" }, { status: 409 })
      )
    );
    const { result } = render();
    const started = await result.current.startRecording(MEETING);
    expect(started.isErr() && started.error.status).toBe(409);
  });
});
