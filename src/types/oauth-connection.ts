import { Provider } from "@/types/provider";

export type OAuthProvider = Provider;

export interface OAuthConnection {
  provider: OAuthProvider;
  /** Null when the provider did not return an email address (e.g. limited OAuth scope). Intentionally nullable at this API boundary. */
  email: string | null;
  connected_at: string;
}
