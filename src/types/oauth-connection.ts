// Mirrors the backend Provider enum (entity/src/provider.rs).
// Add new values here as the backend adds new OAuth providers.
export type OAuthProvider = "google";

export interface OAuthConnection {
  provider: OAuthProvider;
  email: string | null;
  connected_at: string;
}
