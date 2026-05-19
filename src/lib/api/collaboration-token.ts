import { Jwt, parseJwt } from "@/types/jwt";
import { sessionGuard } from "@/lib/auth/session-guard";
import { siteConfig } from "@/site.config";
import { useSwrWithBackoff } from "@/lib/hooks/use-swr-with-backoff";

type FetcherArgs = [string, string];
const fetcher = async ([url, coachingSessionId]: FetcherArgs): Promise<Jwt> => {
  const response = await sessionGuard.get(url, {
    params: { coaching_session_id: coachingSessionId },
  });

  const data = response.data.data;
  return parseJwt(data);
};

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
 * @returns An object containing the token, loading state, and error state.
 */
export const useCollaborationToken = (coachingSessionId: string) => {
  const requestKey = coachingSessionId
    ? [
        `${siteConfig.env.backendServiceURL}/jwt/generate_collab_token`,
        coachingSessionId,
      ]
    : null;

  const { data, isLoading, isError } = useSwrWithBackoff<Jwt>(
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
  };
};
