import { Jwt, parseJwt } from "@/types/jwt";
import { sessionGuard } from "@/lib/auth/session-guard";
import { siteConfig } from "@/site.config";
import { useSwrWithBackoff } from "@/lib/hooks/use-swr-with-backoff";
import { useCallback } from "react";
import { useSWRConfig } from "swr";

const COLLAB_TOKEN_URL = `${siteConfig.env.backendServiceURL}/jwt/generate_collab_token`;

export const fetchCollaborationToken = async (
  coachingSessionId: string
): Promise<Jwt> => {
  const response = await sessionGuard.get(COLLAB_TOKEN_URL, {
    params: { coaching_session_id: coachingSessionId },
  });
  return parseJwt(response.data.data);
};

type FetcherArgs = [string, string];
const toRequestKey = (coachingSessionId: string): FetcherArgs => [
  COLLAB_TOKEN_URL,
  coachingSessionId,
];
const fetcher = ([, coachingSessionId]: FetcherArgs): Promise<Jwt> =>
  fetchCollaborationToken(coachingSessionId);

/**
 * Custom hook to fetch a collaboration token for a given coaching session ID.
 *
 * On first-join of a freshly-created session, the TipTap document is being
 * created asynchronously server-side and the token endpoint may transiently
 * 404 or 5xx. `useSwrWithBackoff` defaults give ~9.3s of retries
 * (300, 600, 1.2s, 2.4s, 4.8s with exponential backoff), which sits inside
 * the editor's 10s sync timeout so the user never sees the failure state
 * while the doc is still being provisioned.
 *
 * @param coachingSessionId - The ID of the coaching session.
 * @returns An object containing the token, loading state, error state, and a
 * `refresh` that revalidates the token.
 */
export const useCollaborationToken = (coachingSessionId: string) => {
  const requestKey: FetcherArgs | null = coachingSessionId
    ? toRequestKey(coachingSessionId)
    : null;

  // Bound to the app's scoped SWR cache; the global `mutate` would miss it.
  const { mutate } = useSWRConfig();
  const refresh = useCallback(
    (): Promise<Jwt | undefined> =>
      coachingSessionId
        ? mutate<Jwt>(toRequestKey(coachingSessionId))
        : Promise.resolve(undefined),
    [coachingSessionId, mutate]
  );

  const { data, isLoading, isError } = useSwrWithBackoff<Jwt, FetcherArgs | null>(
    requestKey,
    fetcher,
    {
      // Prevent automatic revalidation that could cause transient error states
      // during tab switches. The token is only needed for initial provider setup,
      // and the WebSocket connection persists once established.
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    jwt: data,
    isLoading,
    // Coerce to boolean at this hook's boundary: the underlying generic
    // hook reports the raw thrown value (`unknown`), but every caller of
    // useCollaborationToken treats this as a terminal-error flag.
    isError: !!isError,
    refresh,
  };
};
