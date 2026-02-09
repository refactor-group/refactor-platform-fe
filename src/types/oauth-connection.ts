export enum GoogleOAuthConnectionStatus {
  Connected = "connected",
  Disconnected = "disconnected",
}

export type GoogleOAuthConnectionState =
  | {
      status: GoogleOAuthConnectionStatus.Connected;
      google_email: string;
      connected_at: string;
    }
  | { status: GoogleOAuthConnectionStatus.Disconnected };

export function defaultGoogleOAuthConnectionState(): GoogleOAuthConnectionState {
  return { status: GoogleOAuthConnectionStatus.Disconnected };
}

export function isGoogleOAuthConnected(
  state: GoogleOAuthConnectionState
): state is Extract<
  GoogleOAuthConnectionState,
  { status: GoogleOAuthConnectionStatus.Connected }
> {
  return state.status === GoogleOAuthConnectionStatus.Connected;
}
