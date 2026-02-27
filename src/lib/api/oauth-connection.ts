// Interacts with the OAuth connection endpoints

import { siteConfig } from "@/site.config";
import { OAuthConnection } from "@/types/oauth-connection";
import { EntityApi, EntityApiError } from "./entity-api";
import useSWR from "swr";

const OAUTH_CONNECTIONS_URL = `${siteConfig.env.backendServiceURL}/oauth/connections`;
const OAUTH_GOOGLE_URL = `${siteConfig.env.backendServiceURL}/oauth/google`;

export const OAuthConnectionApi = {
  /**
   * Lists all OAuth connections for the authenticated user.
   */
  list: (): Promise<OAuthConnection[]> =>
    EntityApi.listFn<OAuthConnection>(OAUTH_CONNECTIONS_URL, {}),

  /**
   * Gets the Google OAuth connection for the authenticated user.
   * Returns null if not connected (404 → null).
   */
  getGoogle: async (): Promise<OAuthConnection | null> => {
    try {
      return await EntityApi.getFn<OAuthConnection>(
        `${OAUTH_CONNECTIONS_URL}/google`
      );
    } catch (err) {
      if (err instanceof EntityApiError && err.status === 404) return null;
      throw err;
    }
  },

  /**
   * Disconnects the user's Google OAuth connection.
   * Deletes the oauth_connections row on the backend.
   */
  disconnectGoogle: (): Promise<void> =>
    EntityApi.deleteFn<void, void>(`${OAUTH_CONNECTIONS_URL}/google`),

  /**
   * Returns the full backend URL for initiating the Google OAuth flow.
   * The frontend navigates the browser to this URL, and the backend handles
   * the entire OAuth round-trip via browser redirects.
   */
  getAuthorizeUrl: (userId: string): string =>
    `${OAUTH_GOOGLE_URL}/authorize?user_id=${userId}`,
};

/**
 * SWR hook for fetching the Google OAuth connection.
 *
 * Returns null for connection when not connected (404), or the OAuthConnection
 * when connected. Does not surface 404 as an error.
 */
export const useGoogleOAuthConnection = () => {
  const { data, error, isLoading, mutate } = useSWR<OAuthConnection | null>(
    `${OAUTH_CONNECTIONS_URL}/google`,
    OAuthConnectionApi.getGoogle,
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    connection: data ?? null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
};

// Keep the old name as an alias so the integrations page doesn't need a separate change.
export const useGoogleOAuthConnectionStatus = useGoogleOAuthConnection;
