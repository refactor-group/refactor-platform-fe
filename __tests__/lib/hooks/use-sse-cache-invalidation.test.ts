import { describe, it, expect } from "vitest";
import { matchesEndpoint } from "@/lib/hooks/use-sse-cache-invalidation";

/**
 * Test Suite: matchesEndpoint
 * Story: "Invalidate a cache key when its URL belongs to a given endpoint at
 * any path depth, without accidentally matching unrelated endpoints whose
 * path happens to contain the same substring."
 */

const BASE = "http://localhost:4000/api";

describe("matchesEndpoint", () => {
  it("matches the top-level endpoint path", () => {
    expect(matchesEndpoint(`${BASE}/actions`, BASE, "/actions")).toBe(true);
  });

  it("matches the endpoint with a query string", () => {
    expect(matchesEndpoint(`${BASE}/actions?foo=1`, BASE, "/actions")).toBe(true);
  });

  it("matches a single-resource URL under the endpoint", () => {
    expect(matchesEndpoint(`${BASE}/actions/abc-123`, BASE, "/actions")).toBe(true);
  });

  it("matches a nested user-scoped endpoint (regression: previously missed)", () => {
    expect(matchesEndpoint(`${BASE}/users/u-1/actions`, BASE, "/actions")).toBe(true);
    expect(matchesEndpoint(`${BASE}/users/u-1/actions?status=InProgress`, BASE, "/actions")).toBe(true);
  });

  it("matches a nested relationship-scoped endpoint", () => {
    expect(
      matchesEndpoint(
        `${BASE}/organizations/o-1/coaching_relationships/r-1/actions`,
        BASE,
        "/actions",
      ),
    ).toBe(true);
  });

  it("does not match an unrelated endpoint whose name contains the target substring", () => {
    expect(matchesEndpoint(`${BASE}/actions_log`, BASE, "/actions")).toBe(false);
    expect(matchesEndpoint(`${BASE}/my-actions`, BASE, "/actions")).toBe(false);
  });

  it("does not match URLs outside of baseUrl", () => {
    expect(
      matchesEndpoint("http://other-host/actions", BASE, "/actions"),
    ).toBe(false);
  });

  it("works for the /goals endpoint including nested forms", () => {
    expect(matchesEndpoint(`${BASE}/goals`, BASE, "/goals")).toBe(true);
    expect(matchesEndpoint(`${BASE}/goals/g-1`, BASE, "/goals")).toBe(true);
    expect(matchesEndpoint(`${BASE}/users/u-1/goals`, BASE, "/goals")).toBe(true);
    expect(matchesEndpoint(`${BASE}/goals_history`, BASE, "/goals")).toBe(false);
  });
});
