import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";

import { useSwrWithBackoff } from "@/lib/hooks/use-swr-with-backoff";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

const httpError = (status: number) => {
  const err = new Error(`HTTP ${status}`) as Error & {
    response?: { status: number };
  };
  err.response = { status };
  return err;
};

describe("useSwrWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("returns data on a successful first attempt", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("hello");

    const { result } = renderHook(
      () => useSwrWithBackoff<string>("k1", fetcher),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("hello"));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("treats a falsy resolved value as loaded, not still-loading", async () => {
    // Guards against `isLoading: !data` regression — 0, "", false are valid Data.
    const fetcher = vi.fn().mockResolvedValueOnce(0);

    const { result } = renderHook(
      () => useSwrWithBackoff<number>("k1", fetcher),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe(0));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBeUndefined();
  });

  it("does not fetch when the key is null", async () => {
    const fetcher = vi.fn();
    const { result } = renderHook(
      () => useSwrWithBackoff<string>(null, fetcher),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBeUndefined();
  });

  it("fails fast on a default skip-status (401) without retrying", async () => {
    const fetcher = vi.fn().mockRejectedValue(httpError(401));

    const { result } = renderHook(
      () => useSwrWithBackoff<string>("k1", fetcher),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBeDefined());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it("fails fast on a default skip-status (403) without retrying", async () => {
    const fetcher = vi.fn().mockRejectedValue(httpError(403));

    const { result } = renderHook(
      () => useSwrWithBackoff<string>("k1", fetcher),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBeDefined());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("respects a custom skipStatuses list", async () => {
    const fetcher = vi.fn().mockRejectedValue(httpError(404));

    const { result } = renderHook(
      () =>
        useSwrWithBackoff<string>("k1", fetcher, { skipStatuses: [404] }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBeDefined());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // Single call: 404 is in skipStatuses, so no retry was scheduled.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("suppresses isError during transient failures and recovers on retry", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce("ok");

    const { result } = renderHook(
      () => useSwrWithBackoff<string>("k1", fetcher),
      { wrapper }
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(result.current.isError).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    await waitFor(() => expect(result.current.data).toBe("ok"));
    expect(result.current.isError).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("surfaces isError only after retries are exhausted (default 5 retries)", async () => {
    const fetcher = vi.fn().mockRejectedValue(httpError(503));

    const { result } = renderHook(
      () => useSwrWithBackoff<string>("k1", fetcher),
      { wrapper }
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(result.current.isError).toBeUndefined();

    // 300 + 600 + 1200 + 2400 + 4800 ≈ 9.3s; advance with headroom.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() => expect(result.current.isError).toBeDefined());
    // 1 initial + 5 retries = 6 total.
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(result.current.isLoading).toBe(false);
  });

  it("honors a custom maxRetries", async () => {
    const fetcher = vi.fn().mockRejectedValue(httpError(503));

    const { result } = renderHook(
      () => useSwrWithBackoff<string>("k1", fetcher, { maxRetries: 2 }),
      { wrapper }
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    await waitFor(() => expect(result.current.isError).toBeDefined());
    // 1 initial + 2 retries = 3 total.
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("resets retriesExhausted when the key changes", async () => {
    const fetcher = vi.fn().mockRejectedValue(httpError(503));

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useSwrWithBackoff<string>(key, fetcher),
      { wrapper, initialProps: { key: "k1" } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await waitFor(() => expect(result.current.isError).toBeDefined());

    fetcher.mockReset();
    fetcher.mockResolvedValueOnce("hello-2");

    rerender({ key: "k2" });

    // After the render-time reset, isError must be undefined before the new fetch resolves.
    expect(result.current.isError).toBeUndefined();

    await waitFor(() => expect(result.current.data).toBe("hello-2"));
    expect(result.current.isError).toBeUndefined();
  });
});
