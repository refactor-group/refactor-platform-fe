// Interacts with the Google OAuth connection endpoints

import { siteConfig } from "@/site.config";
import {
  GoogleOAuthConnectionState,
  defaultGoogleOAuthConnectionState,
} from "@/types/oauth-connection";
import { EntityApi } from "./entity-api";

const OAUTH_GOOGLE_BASEURL = `${siteConfig.env.backendServiceURL}/oauth/google`;

export const GoogleOAuthApi = {
  /**
   * Fetches the current Google OAuth connection status for the authenticated user.
   *
   * @returns Promise resolving to the GoogleOAuthConnectionState
   */
  getConnectionStatus: async (): Promise<GoogleOAuthConnectionState> =>
    EntityApi.getFn<GoogleOAuthConnectionState>(`${OAUTH_GOOGLE_BASEURL}/status`),

  /**
   * Disconnects the user's Google OAuth connection.
   * Revokes tokens and deletes from oauth_connections on the backend.
   *
   * @returns Promise resolving when disconnection is complete
   */
  disconnect: async (): Promise<void> =>
    EntityApi.deleteFn<void, void>(OAUTH_GOOGLE_BASEURL),

  /**
   * Returns the full backend URL for initiating the Google OAuth flow.
   * The frontend navigates the browser to this URL, and the backend handles
   * the entire OAuth round-trip via browser redirects.
   *
   * @param userId - The ID of the user initiating the OAuth flow
   */
  getAuthorizeUrl: (userId: string): string =>
    `${OAUTH_GOOGLE_BASEURL}/authorize?user_id=${userId}`,
};

/**
 * SWR hook for fetching the Google OAuth connection status.
 *
 * @returns Object containing:
 *   - connectionStatus: The current GoogleOAuthConnectionState
 *   - isLoading: Boolean indicating if data is being fetched
 *   - isError: Error object if the fetch failed
 *   - refresh: Function to manually trigger a refresh
 */
export const useGoogleOAuthConnectionStatus = () => {
  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<GoogleOAuthConnectionState>(
      `${OAUTH_GOOGLE_BASEURL}/status`,
      () => GoogleOAuthApi.getConnectionStatus(),
      defaultGoogleOAuthConnectionState()
    );

  return {
    connectionStatus: entity,
    isLoading,
    isError,
    refresh,
  };
};
