import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { CoachingSessionViewApi } from "@/lib/api/coaching-session-views";
import { sessionGuard } from "@/lib/auth/session-guard";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { post: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const BASE = "http://localhost:3000/coaching_sessions";

describe("CoachingSessionViewApi.markViewed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs to the session's /view sub-route (no body)", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({
      data: { data: { previous_last_viewed_at: null, last_viewed_at: "2026-06-10T10:00:00Z" } },
    } as never);
    await CoachingSessionViewApi.markViewed("s1");
    expect(sessionGuard.post).toHaveBeenCalledWith(`${BASE}/s1/view`);
  });

  it("wraps a present previous marker in Some (the unread anchor)", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({
      data: {
        data: {
          previous_last_viewed_at: "2026-06-05T09:00:00Z",
          last_viewed_at: "2026-06-10T10:00:00Z",
        },
      },
    } as never);
    const r = await CoachingSessionViewApi.markViewed("s1");
    expect(r.previousLastViewedAt.some).toBe(true);
    expect(r.previousLastViewedAt.some && r.previousLastViewedAt.val.toISO()).toBe(
      DateTime.fromISO("2026-06-05T09:00:00Z").toISO()
    );
    expect(r.lastViewedAt instanceof DateTime).toBe(true);
  });

  it("maps a null previous marker (first view) to None", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({
      data: { data: { previous_last_viewed_at: null, last_viewed_at: "2026-06-10T10:00:00Z" } },
    } as never);
    const r = await CoachingSessionViewApi.markViewed("s1");
    expect(r.previousLastViewedAt.some).toBe(false);
  });
});
