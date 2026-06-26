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

  it("matches the session-scoped topics list for topics_changed invalidation", () => {
    expect(
      matchesEndpoint(`${BASE}/coaching_sessions/s-1/topics`, BASE, "/topics"),
    ).toBe(true);
    expect(
      matchesEndpoint(`${BASE}/coaching_sessions/s-1/topics?x=1`, BASE, "/topics"),
    ).toBe(true);
    expect(matchesEndpoint(`${BASE}/topics_archive`, BASE, "/topics")).toBe(false);
  });

  // coaching_session_title_updated invalidates the /coaching_sessions segment so a
  // title rename by either participant refreshes both the single read and the
  // enriched list reads that surface display_title.
  it("matches the coaching session reads for coaching_session_title_updated", () => {
    expect(
      matchesEndpoint(`${BASE}/coaching_sessions/s-1`, BASE, "/coaching_sessions"),
    ).toBe(true);
    expect(
      matchesEndpoint(`${BASE}/users/u-1/coaching_sessions`, BASE, "/coaching_sessions"),
    ).toBe(true);
    expect(
      matchesEndpoint(
        `${BASE}/coaching_sessions?coaching_relationship_id=r-1`,
        BASE,
        "/coaching_sessions",
      ),
    ).toBe(true);
    expect(
      matchesEndpoint(`${BASE}/coaching_sessions_archive`, BASE, "/coaching_sessions"),
    ).toBe(false);
  });

  // Intentional over-match: invalidating /coaching_sessions also revalidates
  // session subresource caches (topics/goals/...). Harmless extra refetches on an
  // infrequent title edit; documented so it is a tested property, not a surprise.
  it("also matches session subresource caches (intentional, coarse)", () => {
    expect(
      matchesEndpoint(`${BASE}/coaching_sessions/s-1/topics`, BASE, "/coaching_sessions"),
    ).toBe(true);
    expect(
      matchesEndpoint(`${BASE}/coaching_sessions/s-1/goals`, BASE, "/coaching_sessions"),
    ).toBe(true);
  });

  // The raw matcher still matches the month count caches; the title listener
  // (invalidateCoachingSessionTitle) excludes them separately, since a rename
  // can't change a count. This documents that the exclusion lives in the
  // listener, not in matchesEndpoint.
  it("matchesEndpoint still matches the count caches (exclusion is in the title listener)", () => {
    expect(
      matchesEndpoint(
        `${BASE}/users/u-1/coaching_sessions/counts`,
        BASE,
        "/coaching_sessions",
      ),
    ).toBe(true);
  });
});
