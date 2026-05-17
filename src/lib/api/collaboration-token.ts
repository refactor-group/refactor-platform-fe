import { useState } from "react";
import useSWR from "swr";
import { Jwt, parseJwt } from "@/types/jwt";
import { sessionGuard } from "@/lib/auth/session-guard";
import { siteConfig } from "@/site.config";

type FetcherArgs = [string, string];
const fetcher = async ([url, coachingSessionId]: FetcherArgs): Promise<Jwt> => {
  const response = await sessionGuard.get(url, {
    params: { coaching_session_id: coachingSessionId },
  });

  const data = response.data.data;
  return parseJwt(data);
};

// On first-join of a freshly-created session, the TipTap document is being
// created asynchronously server-side and the token endpoint may transiently
// 404 or 5xx. The values below give roughly 9s of retries
// (300, 600, 1.2s, 2.4s, 4.8s with exponential backoff), which sits inside
// the editor's 10s sync timeout so the user never sees the failure state
// while the doc is still being provisioned.
const MAX_TOKEN_RETRIES = 5;
const TOKEN_RETRY_BASE_MS = 300;

/**
 * Custom hook to fetch a collaboration token for a given coaching session ID.
 * @param coachingSessionId - The ID of the coaching session.
 * @returns An object containing the token, loading state, and error state.
 */
export const useCollaborationToken = (coachingSessionId: string) => {
  const requestKey = coachingSessionId
    ? [
        `${siteConfig.env.backendServiceURL}/jwt/generate_collab_token`,
        coachingSessionId,
      ]
    : null;

  // Tracks whether retries are exhausted so we only surface `isError` to
  // callers when the failure is terminal — not for per-attempt errors that
  // SWR will retry from. Otherwise the editor briefly flips to its error
  // UI before the next retry succeeds.
  const [retriesExhausted, setRetriesExhausted] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(coachingSessionId);
  if (lastSessionId !== coachingSessionId) {
    setLastSessionId(coachingSessionId);
    setRetriesExhausted(false);
  }

  const { data, error } = useSWR<Jwt>(requestKey, fetcher, {
    // Prevent automatic revalidation that could cause transient error states
    // during tab switches. The token is only needed for initial provider setup,
    // and the WebSocket connection persists once established.
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    onSuccess: () => setRetriesExhausted(false),
    onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403) {
        setRetriesExhausted(true);
        return;
      }
      if (retryCount > MAX_TOKEN_RETRIES) {
        setRetriesExhausted(true);
        return;
      }
      setTimeout(
        () => revalidate({ retryCount }),
        TOKEN_RETRY_BASE_MS * 2 ** (retryCount - 1)
      );
    },
  });

  const hasTerminalError = !!error && retriesExhausted;

  return {
    jwt: data,
    isLoading: !data && !hasTerminalError,
    isError: hasTerminalError ? error : undefined,
  };
};
