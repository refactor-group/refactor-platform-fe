import axios from "axios";
import useSWR from "swr";
import { Jwt, parseJwt } from "@/types/jwt";
import { siteConfig } from "@/site.config";

const fetcher = async (
  url: string,
  coachingSessionId: string
): Promise<Jwt> => {
  const response = await axios.get(url, {
    params: { coaching_session_id: coachingSessionId },
    withCredentials: true,
    timeout: 5000,
    headers: {
      "X-Version": siteConfig.env.backendApiVersion,
    },
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
  const { data, error } = useSWR<Jwt>(
    coachingSessionId
      ? [`/jwt/generate_collab_token`, coachingSessionId]
      : null,
    ([url, id]) => fetcher(url, coachingSessionId)
  );

  return {
    jwt: data,
    isLoading: !error && !data,
    isError: error,
  };
};
