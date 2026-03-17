// Interacts with the OAuth connection endpoints

import { siteConfig } from "@/site.config";
import { OAuthConnection, OAuthProvider } from "@/types/oauth-connection";
import { EntityApi, EntityApiError } from "./entity-api";
import useSWR from "swr";

const OAUTH_CONNECTIONS_URL = `${siteConfig.env.backendServiceURL}/oauth/connections`;

export const OAuthConnectionApi = {
  /**
   * Lists all OAuth connections for the authenticated user.
   */
  list: (): Promise<OAuthConnection[]> =>
    EntityApi.listFn<OAuthConnection>(OAUTH_CONNECTIONS_URL, {}),

  /**
   * Gets the OAuth connection for the given provider.
   * Returns null if not connected (404 → null).
   */
  getByProvider: async (provider: OAuthProvider): Promise<OAuthConnection | null> => {
    try {
      return await EntityApi.getFn<OAuthConnection>(
        `${OAUTH_CONNECTIONS_URL}/${provider}`
      );
    } catch (err) {
      if (err instanceof EntityApiError && err.status === 404) return null;
      throw err;
    }
  },

  /**
   * Disconnects the user's OAuth connection for the given provider.
   * Deletes the oauth_connections row on the backend.
   */
  disconnect: (provider: OAuthProvider): Promise<void> =>
    EntityApi.deleteFn<void, void>(`${OAUTH_CONNECTIONS_URL}/${provider}`),

  /**
   * Returns the full backend URL for initiating an OAuth flow.
   * The frontend navigates the browser to this URL, and the backend handles
   * the entire OAuth round-trip via browser redirects.
   *
   * The backend validates that user_id matches the authenticated session,
   * so this parameter cannot be used to link another user's account.
   */
  getAuthorizeUrl: (provider: OAuthProvider, userId: string): string =>
    `${siteConfig.env.backendServiceURL}/oauth/${provider}/authorize?user_id=${userId}`,
};

/**
 * SWR hook for fetching an OAuth connection by provider.
 *
 * Returns null for connection when not connected (404), or the OAuthConnection
 * when connected. Does not surface 404 as an error.
 */
export const useOAuthConnection = (provider: OAuthProvider) => {
  const { data, error, isLoading, mutate } = useSWR<OAuthConnection | null>(
    `${OAUTH_CONNECTIONS_URL}/${provider}`,
    () => OAuthConnectionApi.getByProvider(provider),
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

/**
 * SWR hook for fetching all OAuth connections.
 *
 */
export const useOAuthConnections = () => {
  const { data, error, isLoading, mutate } = useSWR(
    `${OAUTH_CONNECTIONS_URL}`,
    () => OAuthConnectionApi.list(),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    connections: data ?? null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
};
