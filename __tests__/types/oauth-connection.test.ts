import { describe, it, expect } from "vitest";
import { OAuthConnection } from "@/types/oauth-connection";
import { OAuthConnectionApi } from "@/lib/api/oauth-connection";

describe("OAuthConnection", () => {
  describe("connected state", () => {
    it("is represented as a non-null OAuthConnection object", () => {
      const connection: OAuthConnection = {
        provider: "google",
        email: "coach@gmail.com",
        connected_at: "2026-01-15T10:00:00Z",
      };
      expect(connection.email).toBe("coach@gmail.com");
      expect(connection.provider).toBe("google");
    });

    it("allows null email for connections without an email address", () => {
      const connection: OAuthConnection = {
        provider: "google",
        email: null,
        connected_at: "2026-01-15T10:00:00Z",
      };
      expect(connection.email).toBeNull();
    });
  });

  describe("disconnected state", () => {
    it("is represented as null", () => {
      const connection: OAuthConnection | null = null;
      expect(connection).toBeNull();
    });
  });

  describe("OAuthConnectionApi.getAuthorizeUrl", () => {
    it("includes the user_id in the query string", () => {
      const url = OAuthConnectionApi.getAuthorizeUrl("google", "user-123");
      expect(url).toContain("user_id=user-123");
    });

    it("includes the provider oauth authorize path", () => {
      const url = OAuthConnectionApi.getAuthorizeUrl("google", "user-456");
      expect(url).toContain("/oauth/google/authorize");
    });
  });
});
