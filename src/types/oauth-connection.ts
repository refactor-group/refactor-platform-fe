// Mirrors the backend Provider enum (entity/src/provider.rs).
// Add new values here as the backend adds new OAuth providers.
export type OAuthProvider = "google";

export interface OAuthConnection {
  provider: OAuthProvider;
  /** Null when the provider did not return an email address (e.g. limited OAuth scope). Intentionally nullable at this API boundary. */
  email: string | null;
  connected_at: string;
}
