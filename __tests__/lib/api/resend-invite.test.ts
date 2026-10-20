// Resending calendar invites: exact paths, no body, and typed failures.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Result } from "neverthrow";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { sessionGuard } from "@/lib/auth/session-guard";
import { Some } from "@/types/option";
import { ResendInviteRefusal, type ResendInviteFailure } from "@/types/resend-invite";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const BASE = "http://localhost:3000";

const httpError = (status: number, data: unknown = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, statusText: "", data, headers: {}, config: {} },
  });

const conflict = (reason: string) => ({
  status_code: 409,
  error: "conflict",
  message: "refused",
  details: { reason },
});

const failureOf = async (
  call: Promise<Result<void, ResendInviteFailure>>
): Promise<ResendInviteFailure> => {
  const result = await call;
  if (result.isOk()) throw new Error("expected a failure");
  return result.error;
};

describe("resendInvite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs to the series' resend_invite route with no body", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({ status: 204, data: "" } as never);
    const result = await CoachingSessionSeriesApi.resendInvite("ser-1");
    expect(sessionGuard.post).toHaveBeenCalledWith(
      `${BASE}/coaching_session_series/ser-1/resend_invite`
    );
    expect(result.isOk()).toBe(true);
  });

  it("POSTs to the session's resend_invite route with no body", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({ status: 204, data: "" } as never);
    const result = await CoachingSessionApi.resendInvite("s-1");
    expect(sessionGuard.post).toHaveBeenCalledWith(
      `${BASE}/coaching_sessions/s-1/resend_invite`
    );
    expect(result.isOk()).toBe(true);
  });

  it.each([
    ["legacy_series", ResendInviteRefusal.LegacySeries],
    ["no_upcoming_sessions", ResendInviteRefusal.NoUpcomingSessions],
    ["series_member", ResendInviteRefusal.SeriesMember],
  ])("maps 409 %s to refused", async (wire, reason) => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(409, conflict(wire)));
    expect(await failureOf(CoachingSessionSeriesApi.resendInvite("ser-1"))).toEqual({
      kind: "refused",
      reason,
    });
  });

  it("maps a 409 with no details to unexpected", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(
      httpError(409, { status_code: 409, error: "conflict", message: "refused" })
    );
    expect(await failureOf(CoachingSessionApi.resendInvite("s-1"))).toEqual({
      kind: "unexpected",
      status: Some(409),
    });
  });

  it("maps 502 to not_delivered", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(502));
    expect(await failureOf(CoachingSessionApi.resendInvite("s-1"))).toEqual({
      kind: "not_delivered",
    });
  });

  it("maps 403 to unexpected", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(403));
    expect(await failureOf(CoachingSessionSeriesApi.resendInvite("ser-1"))).toEqual({
      kind: "unexpected",
      status: Some(403),
    });
  });
});
