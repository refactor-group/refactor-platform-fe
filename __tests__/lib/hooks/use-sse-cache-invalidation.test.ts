import { describe, it, expect } from "vitest";
import {
  matchesEndpoint,
  upsertAgreementInList,
  removeAgreementFromList,
} from "@/lib/hooks/use-sse-cache-invalidation";
import type { Agreement } from "@/types/agreement";
import { DateTime } from "ts-luxon";

const makeAgreement = (id: string, body: string): Agreement => ({
  id,
  coaching_session_id: "s-1",
  body,
  user_id: "u-1",
  created_at: DateTime.now(),
  updated_at: DateTime.now(),
});

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
});

/**
 * Test Suite: agreement in-place cache patching
 * Story: "Apply a fine-grained agreement_* SSE entity to a cached list without a
 * refetch — append on create, replace on update, remove on delete."
 */
describe("upsertAgreementInList", () => {
  it("appends a new agreement (create)", () => {
    const list = [makeAgreement("a-1", "first")];
    const next = upsertAgreementInList(list, makeAgreement("a-2", "second"));
    expect(next.map((a) => a.id)).toEqual(["a-1", "a-2"]);
  });

  it("replaces an existing agreement in place (update), preserving position", () => {
    const list = [makeAgreement("a-1", "first"), makeAgreement("a-2", "second")];
    const next = upsertAgreementInList(list, makeAgreement("a-1", "edited"));
    expect(next.map((a) => a.id)).toEqual(["a-1", "a-2"]);
    expect(next[0].body).toBe("edited");
  });

  it("does not mutate the input array", () => {
    const list = [makeAgreement("a-1", "first")];
    const snapshot = [...list];
    upsertAgreementInList(list, makeAgreement("a-2", "second"));
    expect(list).toEqual(snapshot);
  });

  it("handles an empty starting list", () => {
    const next = upsertAgreementInList([], makeAgreement("a-1", "first"));
    expect(next.map((a) => a.id)).toEqual(["a-1"]);
  });
});

describe("removeAgreementFromList", () => {
  it("removes the agreement with the matching id", () => {
    const list = [makeAgreement("a-1", "first"), makeAgreement("a-2", "second")];
    const next = removeAgreementFromList(list, "a-1");
    expect(next.map((a) => a.id)).toEqual(["a-2"]);
  });

  it("is a no-op when the id is absent", () => {
    const list = [makeAgreement("a-1", "first")];
    const next = removeAgreementFromList(list, "a-999");
    expect(next.map((a) => a.id)).toEqual(["a-1"]);
  });

  it("does not mutate the input array", () => {
    const list = [makeAgreement("a-1", "first"), makeAgreement("a-2", "second")];
    const snapshot = [...list];
    removeAgreementFromList(list, "a-1");
    expect(list).toEqual(snapshot);
  });
});
