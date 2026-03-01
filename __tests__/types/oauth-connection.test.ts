import { describe, it, expect } from "vitest";
import {
  GoogleOAuthConnectionStatus,
  GoogleOAuthConnectionState,
  defaultGoogleOAuthConnectionState,
  isGoogleOAuthConnected,
} from "@/types/oauth-connection";

describe("GoogleOAuthConnectionState", () => {
  describe("defaultGoogleOAuthConnectionState", () => {
    it("returns disconnected state", () => {
      const state = defaultGoogleOAuthConnectionState();
      expect(state.status).toBe(GoogleOAuthConnectionStatus.Disconnected);
    });
  });

  describe("isGoogleOAuthConnected", () => {
    it("returns true for connected state", () => {
      const state: GoogleOAuthConnectionState = {
        status: GoogleOAuthConnectionStatus.Connected,
        google_email: "coach@gmail.com",
        connected_at: "2026-01-15T10:00:00Z",
      };
      expect(isGoogleOAuthConnected(state)).toBe(true);
    });

    it("returns false for disconnected state", () => {
      const state: GoogleOAuthConnectionState = {
        status: GoogleOAuthConnectionStatus.Disconnected,
      };
      expect(isGoogleOAuthConnected(state)).toBe(false);
    });

    it("narrows type to expose google_email and connected_at when connected", () => {
      const state: GoogleOAuthConnectionState = {
        status: GoogleOAuthConnectionStatus.Connected,
        google_email: "test@example.com",
        connected_at: "2026-02-01T12:00:00Z",
      };

      if (isGoogleOAuthConnected(state)) {
        // TypeScript should narrow the type, giving access to these fields
        expect(state.google_email).toBe("test@example.com");
        expect(state.connected_at).toBe("2026-02-01T12:00:00Z");
      }
    });
  });
});
