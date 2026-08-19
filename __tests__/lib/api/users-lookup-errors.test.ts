import { describe, it, expect } from "vitest";
import { EntityApiError } from "@/types/entity-api-error";
import {
  USER_LOOKUP_RATE_LIMITED_MESSAGE,
  userLookupRateLimitedMessage,
} from "@/lib/api/users";

/** Mirrors the sibling organization-errors suite so both read the same way. */
function apiError(status: number, data?: unknown): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Too Many Requests", data },
  });
  return new EntityApiError("GET", "/users", axiosLike);
}

describe("userLookupRateLimitedMessage", () => {
  it("matches a 429 carrying the backend's slug and message", () => {
    // The shape measured off the wire for UserLookupEndpoint v2.
    expect(
      userLookupRateLimitedMessage(
        apiError(429, {
          error: "user_lookup_rate_limited",
          message: "Too many user lookups. Please wait before trying again.",
          status_code: 429,
        })
      )
    ).toBe(USER_LOOKUP_RATE_LIMITED_MESSAGE);
  });

  it("still matches a 429 with no slug, or no body at all", () => {
    // The platform's other 429 (password reset) answers in plain text. If this
    // endpoint ever follows suit, the admin must still get the real reason.
    expect(userLookupRateLimitedMessage(apiError(429))).toBe(
      USER_LOOKUP_RATE_LIMITED_MESSAGE
    );
    expect(
      userLookupRateLimitedMessage(apiError(429, "TOO MANY REQUESTS"))
    ).toBe(USER_LOOKUP_RATE_LIMITED_MESSAGE);
  });

  it("declines the endpoint's other failures, which are bare strings", () => {
    // 400/401/403 carry no slug, so status is the only discriminator and it
    // must not over-match.
    expect(userLookupRateLimitedMessage(apiError(400, "BAD REQUEST"))).toBeNull();
    expect(userLookupRateLimitedMessage(apiError(403, "FORBIDDEN"))).toBeNull();
  });

  it("declines a non-API error", () => {
    expect(userLookupRateLimitedMessage(new Error("network down"))).toBeNull();
    expect(userLookupRateLimitedMessage(undefined)).toBeNull();
  });

  it("states the cause without backend policy or a retry time", () => {
    // No cap and no duration: the first is policy the reader cannot act on, the
    // second would be a guess, since the window is a rolling count and the
    // backend sends no Retry-After.
    expect(USER_LOOKUP_RATE_LIMITED_MESSAGE).toMatch(/searches/);
    expect(USER_LOOKUP_RATE_LIMITED_MESSAGE).not.toMatch(/\d/);
  });
});
