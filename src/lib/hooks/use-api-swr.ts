"use client";

import useSWR, {
  type BareFetcher,
  type Key,
  type SWRConfiguration,
  type SWRResponse,
} from "swr";
import { useFailFastRetry } from "@/lib/hooks/use-fail-fast-retry";

/**
 * `useSWR` with this codebase's retry policy applied — see
 * {@link useFailFastRetry}. Use this instead of `useSWR` directly for any
 * backend read, so a permanently-denied endpoint stops being retried rather
 * than being hammered on SWR's unbounded backoff.
 *
 * Identical to `useSWR` in every other respect; a caller's own `onErrorRetry`
 * still governs the failures the policy doesn't treat as terminal.
 */
// `Data`/`Err` default to `any` to mirror `useSWR`'s own signature — callers
// that don't parameterize keep the error type they had before this seam existed.
export function useApiSWR<Data = any, Err = any>(
  key: Key,
  fetcher: BareFetcher<Data> | null,
  options?: SWRConfiguration<Data, Err>
): SWRResponse<Data, Err> {
  const onErrorRetry = useFailFastRetry(options?.onErrorRetry);

  return useSWR<Data, Err>(key, fetcher, { ...options, onErrorRetry });
}
