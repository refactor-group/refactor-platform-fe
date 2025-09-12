import useSWR from "swr";
import { Jwt, parseJwt } from "@/types/jwt";
import { sessionGuard } from "@/lib/session/session-guard";
import { siteConfig } from "@/site.config";

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

  const { data, error } = useSWR<Jwt>(requestKey, fetcher);

  return {
    jwt: data,
    isLoading: !error && !data,
    isError: error,
  };
};
