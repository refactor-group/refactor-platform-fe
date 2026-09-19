import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AxiosError } from "axios";
import { SWRConfig, type SWRConfiguration } from "swr";
import type { ReactNode } from "react";
import { useFailFastRetry } from "@/lib/hooks/use-fail-fast-retry";
import { EntityApiError, httpStatusOf } from "@/types/entity-api-error";

function axiosErrorWithStatus(status: number): AxiosError {
  const error = new AxiosError("request failed");
  error.response = { status } as AxiosError["response"];
  return error;
}

function entityApiError(status: number): EntityApiError {
  return EntityApiError.from("get", "/organizations", axiosErrorWithStatus(status));
}

// SWR's default onErrorRetry is what the hook delegates to when a status isn't
// terminal. Replacing it with a spy makes the delegation observable.
function renderFailFastRetry(
  defaultOnErrorRetry: SWRConfiguration["onErrorRetry"],
  callerOnErrorRetry?: SWRConfiguration["onErrorRetry"]
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ onErrorRetry: defaultOnErrorRetry }}>{children}</SWRConfig>
  );
  return renderHook(() => useFailFastRetry(callerOnErrorRetry), { wrapper });
}

const RETRY_ARGS = [
  "/organizations",
  {} as never,
  vi.fn(),
  { retryCount: 1 },
] as const;

describe("httpStatusOf", () => {
  it("reads the status off an EntityApiError", () => {
    expect(httpStatusOf(entityApiError(403))).toEqual({
      some: true,
      none: false,
      val: 403,
    });
  });

  it("falls back to a raw axios response status", () => {
    expect(httpStatusOf(axiosErrorWithStatus(404))).toEqual({
      some: true,
      none: false,
      val: 404,
    });
  });

  it("is None for a non-HTTP failure", () => {
    expect(httpStatusOf(new Error("network down")).none).toBe(true);
  });
});

describe("useFailFastRetry", () => {
  it.each([401, 403])("stops retrying on %i", (status) => {
    const defaultRetry = vi.fn();
    const { result } = renderFailFastRetry(defaultRetry);

    result.current(entityApiError(status), ...RETRY_ARGS);

    expect(defaultRetry).not.toHaveBeenCalled();
  });

  it("stops on a 403 delivered as a raw axios error", () => {
    const defaultRetry = vi.fn();
    const { result } = renderFailFastRetry(defaultRetry);

    result.current(axiosErrorWithStatus(403), ...RETRY_ARGS);

    expect(defaultRetry).not.toHaveBeenCalled();
  });

  it.each([404, 500, 503])("delegates a retryable %i to SWR", (status) => {
    const defaultRetry = vi.fn();
    const { result } = renderFailFastRetry(defaultRetry);

    result.current(entityApiError(status), ...RETRY_ARGS);

    expect(defaultRetry).toHaveBeenCalledTimes(1);
  });

  it("delegates a network error with no status", () => {
    const defaultRetry = vi.fn();
    const { result } = renderFailFastRetry(defaultRetry);

    result.current(new Error("network down"), ...RETRY_ARGS);

    expect(defaultRetry).toHaveBeenCalledTimes(1);
  });

  it("prefers the caller's policy over SWR's for retryable failures", () => {
    const defaultRetry = vi.fn();
    const callerRetry = vi.fn();
    const { result } = renderFailFastRetry(defaultRetry, callerRetry);

    result.current(entityApiError(503), ...RETRY_ARGS);

    expect(callerRetry).toHaveBeenCalledTimes(1);
    expect(defaultRetry).not.toHaveBeenCalled();
  });

  it("overrides the caller's policy on a terminal status", () => {
    const callerRetry = vi.fn();
    const { result } = renderFailFastRetry(vi.fn(), callerRetry);

    result.current(entityApiError(403), ...RETRY_ARGS);

    expect(callerRetry).not.toHaveBeenCalled();
  });
});
