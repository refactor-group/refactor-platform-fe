import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";

// Mock the axios-backed http client so we control every request outcome.
vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: {
    get: vi.fn(),
  },
}));

import { sessionGuard } from "@/lib/auth/session-guard";
import { useCollaborationToken } from "@/lib/api/collaboration-token";

const mockedGet = vi.mocked(sessionGuard.get);

// Fresh SWR cache per test so retries / dedupe from one test don't leak into another.
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

const okResponse = () => ({
  data: { data: { token: "tok", sub: "sub-1" } },
});

const httpError = (status: number) => {
  const err = new Error(`HTTP ${status}`) as Error & {
    response?: { status: number };
  };
  err.response = { status };
  return err;
};

describe("useCollaborationToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("returns the JWT on a successful first attempt", async () => {
    mockedGet.mockResolvedValueOnce(okResponse());

    const { result } = renderHook(() => useCollaborationToken("session-1"), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.jwt).toEqual({ token: "tok", sub: "sub-1" })
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when coachingSessionId is empty", async () => {
    const { result } = renderHook(() => useCollaborationToken(""), {
      wrapper,
    });

    // Give SWR a chance to do nothing.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedGet).not.toHaveBeenCalled();
    expect(result.current.jwt).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it("surfaces isError immediately on a 401 — does not retry", async () => {
    mockedGet.mockRejectedValue(httpError(401));

    const { result } = renderHook(() => useCollaborationToken("session-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Auth errors are terminal: ensure no further retry scheduled.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(result.current.jwt).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces isError immediately on a 403 — does not retry", async () => {
    mockedGet.mockRejectedValue(httpError(403));

    const { result } = renderHook(() => useCollaborationToken("session-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("suppresses isError during transient failures and recovers when a retry succeeds", async () => {
    mockedGet
      .mockRejectedValueOnce(httpError(404))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(okResponse());

    const { result } = renderHook(() => useCollaborationToken("session-1"), {
      wrapper,
    });

    // After the first failure, SWR's `error` is set, but our hook gates `isError`
    // on retries being exhausted.
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(true);

    // Advance past the first retry (~300ms) and the second (~600ms).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    await waitFor(() =>
      expect(result.current.jwt).toEqual({ token: "tok", sub: "sub-1" })
    );
    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockedGet).toHaveBeenCalledTimes(3);
  });

  it("surfaces isError only after retries are exhausted", async () => {
    // Always fail. 5 retries at 300/600/1200/2400/4800ms + the initial =
    // 6 total calls before isError surfaces.
    mockedGet.mockRejectedValue(httpError(503));

    const { result } = renderHook(() => useCollaborationToken("session-1"), {
      wrapper,
    });

    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    expect(result.current.isError).toBe(false);

    // 300 + 600 + 1200 + 2400 + 4800 ≈ 9.3s of backoff; give some headroom.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedGet).toHaveBeenCalledTimes(6);
    expect(result.current.jwt).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("resets retriesExhausted when coachingSessionId changes", async () => {
    // First session: keep failing until exhausted.
    mockedGet.mockRejectedValue(httpError(503));

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useCollaborationToken(id),
      { wrapper, initialProps: { id: "session-1" } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Switch to a new session that will succeed; the prior terminal-error state
    // should not leak — isError must drop to undefined before the new fetch
    // even resolves.
    mockedGet.mockReset();
    mockedGet.mockResolvedValueOnce(okResponse());

    rerender({ id: "session-2" });

    // Right after the id flip (before SWR settles), isError should already be
    // cleared by the render-time reset.
    expect(result.current.isError).toBe(false);

    await waitFor(() =>
      expect(result.current.jwt).toEqual({ token: "tok", sub: "sub-1" })
    );
    expect(result.current.isError).toBe(false);
  });
});
