import { useState } from "react";
import useSWR, { type Fetcher, type SWRConfiguration } from "swr";

// Narrower than SWR's `Key` (which also accepts functions, BigInts, and
// arbitrary records). The render-time reset hashes the key with
// `JSON.stringify`; functions stringify to `undefined`, so two different
// function keys would collide and a stale `retriesExhausted` could leak
// across a key swap. Restricting accepted shapes to JSON-safe ones means
// the hash is faithful and unsupported keys are a compile-time error
// rather than a silent runtime drift.
type SupportedKey = string | readonly unknown[] | null;

// Defaults tuned for "resource being provisioned asynchronously" cases — the
// first caller is useCollaborationToken, where the TipTap document is created
// lazily on first join. ~9.3s of total backoff fits inside the editor's 10s
// sync timeout. Other callers can override per call site.
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_MS = 300;
const DEFAULT_SKIP_STATUSES: readonly number[] = [401, 403];

// `onErrorRetry` is owned by this hook — it implements the skip/backoff/
// exhaustion policy. Allowing callers to override it would silently
// disable that policy, so it's omitted from the accepted options.
export interface UseSwrWithBackoffOptions<Data>
  extends Omit<SWRConfiguration<Data>, "onErrorRetry"> {
  /** Max retry attempts after the initial request. Default: 5. */
  maxRetries?: number;
  /** Base delay (ms) for exponential backoff: `baseMs * 2 ** (retryCount - 1)`. Default: 300. */
  baseMs?: number;
  /** HTTP statuses that fail fast and skip retries. Default: [401, 403]. */
  skipStatuses?: readonly number[];
}

export interface UseSwrWithBackoffResult<Data> {
  data: Data | undefined;
  isLoading: boolean;
  // `unknown` rather than `Error` because fetchers can throw anything in JS.
  // Callers must narrow (e.g. `isError instanceof Error`) before reading fields.
  isError: unknown;
}

/**
 * SWR with exponential-backoff retries and terminal-error gating.
 *
 * Per-attempt failures are suppressed from `isError` while SWR is still
 * retrying — only surfaces when retries are genuinely exhausted (or the
 * status code is in `skipStatuses`, which fail fast). Resets state when
 * `key` changes so a previously-exhausted session can't leak into a new one.
 */
export function useSwrWithBackoff<Data, K extends SupportedKey = SupportedKey>(
  key: K,
  fetcher: Fetcher<Data, K> | null,
  options: UseSwrWithBackoffOptions<Data> = {}
): UseSwrWithBackoffResult<Data> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseMs = DEFAULT_BASE_MS,
    skipStatuses = DEFAULT_SKIP_STATUSES,
    ...swrConfig
  } = options;

  // Stable-hash the key for the reset check — array-literal keys get a
  // new reference every render, so a raw `!==` would loop forever.
  // `SupportedKey` is JSON-safe by construction (see type definition).
  const keyHash = key === null ? null : JSON.stringify(key);
  const [retriesExhausted, setRetriesExhausted] = useState(false);
  const [lastKeyHash, setLastKeyHash] = useState(keyHash);
  if (lastKeyHash !== keyHash) {
    setLastKeyHash(keyHash);
    setRetriesExhausted(false);
  }

  const { data, error } = useSWR<Data, unknown>(key, fetcher, {
    ...swrConfig,
    onSuccess: (d, k, cfg) => {
      setRetriesExhausted(false);
      swrConfig.onSuccess?.(d, k, cfg);
    },
    onErrorRetry: (err, _k, _cfg, revalidate, { retryCount }) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status !== undefined && skipStatuses.includes(status)) {
        setRetriesExhausted(true);
        return;
      }
      if (retryCount > maxRetries) {
        setRetriesExhausted(true);
        return;
      }
      setTimeout(
        () => revalidate({ retryCount }),
        baseMs * 2 ** (retryCount - 1)
      );
    },
  });

  const hasTerminalError = !!error && retriesExhausted;
  return {
    data,
    // Compare against `undefined` rather than truthiness so falsy payloads
    // (0, "", false) don't get stuck reporting `isLoading: true` forever.
    isLoading: data === undefined && !hasTerminalError,
    isError: hasTerminalError ? error : undefined,
  };
}
