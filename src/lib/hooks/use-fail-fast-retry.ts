"use client";

import { useCallback } from "react";
import { useSWRConfig, type SWRConfiguration } from "swr";
import { httpStatusOf } from "@/types/entity-api-error";

/**
 * Statuses no amount of retrying can fix. 403 means the caller lacks
 * permission (e.g. their organization membership was revoked mid-session);
 * 401 is already being handled by the session guard logging them out.
 */
export const TERMINAL_RETRY_STATUSES: readonly number[] = [401, 403];

type OnErrorRetry = NonNullable<SWRConfiguration["onErrorRetry"]>;

/**
 * SWR retry policy that stops immediately on a terminal status instead of
 * inheriting SWR's unbounded exponential-backoff retry, which would otherwise
 * hammer an endpoint that will never start returning 200.
 *
 * Every other failure delegates to the caller's own `onErrorRetry` when it
 * supplies one, or to SWR's default policy.
 */
export function useFailFastRetry(
  callerOnErrorRetry?: SWRConfiguration["onErrorRetry"]
): OnErrorRetry {
  const { onErrorRetry: defaultOnErrorRetry } = useSWRConfig();

  return useCallback<OnErrorRetry>(
    (error, key, config, revalidate, revalidateOpts) => {
      const status = httpStatusOf(error);
      if (status.some && TERMINAL_RETRY_STATUSES.includes(status.val)) return;

      const delegate = callerOnErrorRetry ?? defaultOnErrorRetry;
      delegate?.(error, key, config, revalidate, revalidateOpts);
    },
    [callerOnErrorRetry, defaultOnErrorRetry]
  );
}
