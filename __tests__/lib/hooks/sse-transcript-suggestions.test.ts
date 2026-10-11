// Frozen acceptance test for fe#477 phase 1: transcript_suggestions_changed
// revalidates only the named session's suggestion caches.

import { describe, it, expect } from "vitest";
import { matchesSessionSuggestions } from "@/lib/hooks/use-sse-cache-invalidation";

const BASE = "http://localhost:4000/api";

describe("matchesSessionSuggestions", () => {
  it("matches the session's action suggestion list", () => {
    expect(
      matchesSessionSuggestions(
        `${BASE}/coaching_sessions/s-1/transcript_suggestions?target=action`,
        BASE,
        "s-1"
      )
    ).toBe(true);
  });

  it("matches the session's list with any query and a bare list", () => {
    expect(
      matchesSessionSuggestions(
        `${BASE}/coaching_sessions/s-1/transcript_suggestions?target=action&status=dismissed`,
        BASE,
        "s-1"
      )
    ).toBe(true);
    expect(
      matchesSessionSuggestions(`${BASE}/coaching_sessions/s-1/transcript_suggestions`, BASE, "s-1")
    ).toBe(true);
  });

  it("does not match another session's suggestions", () => {
    expect(
      matchesSessionSuggestions(
        `${BASE}/coaching_sessions/s-2/transcript_suggestions?target=action`,
        BASE,
        "s-1"
      )
    ).toBe(false);
    expect(
      matchesSessionSuggestions(
        `${BASE}/coaching_sessions/s-10/transcript_suggestions?target=action`,
        BASE,
        "s-1"
      )
    ).toBe(false);
  });

  it("does not match other caches of the same session", () => {
    expect(matchesSessionSuggestions(`${BASE}/coaching_sessions/s-1/topics`, BASE, "s-1")).toBe(
      false
    );
    expect(matchesSessionSuggestions(`${BASE}/coaching_sessions/s-1`, BASE, "s-1")).toBe(false);
    expect(
      matchesSessionSuggestions(`${BASE}/coaching_sessions/s-1/transcript_suggestions_x`, BASE, "s-1")
    ).toBe(false);
  });

  it("does not match URLs outside baseUrl", () => {
    expect(
      matchesSessionSuggestions(
        "http://other/coaching_sessions/s-1/transcript_suggestions?target=action",
        BASE,
        "s-1"
      )
    ).toBe(false);
  });
});
