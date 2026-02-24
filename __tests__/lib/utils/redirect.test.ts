import { describe, it, expect } from "vitest";
import {
  validateRedirectUrl,
  sanitizeCallbackUrl,
  createLoginUrlWithCallback,
} from "@/lib/utils/redirect";

describe("validateRedirectUrl", () => {
  it("returns true for valid internal path", () => {
    expect(validateRedirectUrl("/dashboard")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(validateRedirectUrl("")).toBe(false);
  });

  it("returns false for root path", () => {
    expect(validateRedirectUrl("/")).toBe(false);
  });

  it("returns false for external URL", () => {
    expect(validateRedirectUrl("https://evil.com/steal")).toBe(false);
  });
});

describe("sanitizeCallbackUrl", () => {
  it("returns null when url is null", () => {
    expect(sanitizeCallbackUrl(null)).toBeNull();
  });

  it("returns null when url is undefined", () => {
    expect(sanitizeCallbackUrl(undefined)).toBeNull();
  });

  it("returns null when url is empty string", () => {
    expect(sanitizeCallbackUrl("")).toBeNull();
  });

  it("returns pathname for valid internal URL", () => {
    expect(sanitizeCallbackUrl("/coaching-sessions/abc")).toBe(
      "/coaching-sessions/abc"
    );
  });

  it("returns null for external URL", () => {
    expect(sanitizeCallbackUrl("https://evil.com/steal")).toBeNull();
  });

  it("preserves query string and hash", () => {
    expect(sanitizeCallbackUrl("/sessions?tab=notes#section")).toBe(
      "/sessions?tab=notes#section"
    );
  });
});

describe("createLoginUrlWithCallback", () => {
  it("creates encoded callback URL", () => {
    const result = createLoginUrlWithCallback("/coaching-sessions/123");
    expect(result).toBe("/?callbackUrl=%2Fcoaching-sessions%2F123");
  });
});
