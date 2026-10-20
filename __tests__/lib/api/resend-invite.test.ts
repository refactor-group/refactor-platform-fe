import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { sessionGuard } from "@/lib/auth/session-guard";
import { Some } from "@/types/option";
import { ResendInviteRefusal } from "@/types/resend-invite";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const axiosError = (response?: { status: number; data: unknown }) =>
  Object.assign(new Error("Request failed"), { isAxiosError: true, response });

const refusal = (reason: string) =>
  axiosError({ status: 409, data: { status_code: 409, details: { reason } } });

describe("resendInvite", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["series", () => CoachingSessionSeriesApi.resendInvite("ser-1"), "/coaching_session_series/ser-1/resend_invite"],
    ["session", () => CoachingSessionApi.resendInvite("s-1"), "/coaching_sessions/s-1/resend_invite"],
  ])("POSTs a %s resend to its route with no body", async (_, call, path) => {
    vi.mocked(sessionGuard.post).mockResolvedValue({ status: 204, data: "" } as never);
    const result = await call();
    expect(sessionGuard.post).toHaveBeenCalledWith(`http://localhost:3000${path}`);
    expect(result.isOk()).toBe(true);
  });

  it.each([
    ["409 legacy_series", refusal("legacy_series"), { kind: "refused", reason: ResendInviteRefusal.LegacySeries }],
    ["409 no_upcoming_sessions", refusal("no_upcoming_sessions"), { kind: "refused", reason: ResendInviteRefusal.NoUpcomingSessions }],
    ["409 series_member", refusal("series_member"), { kind: "refused", reason: ResendInviteRefusal.SeriesMember }],
    ["409 without a reason", axiosError({ status: 409, data: { status_code: 409 } }), { kind: "unexpected", status: Some(409) }],
    ["502", axiosError({ status: 502, data: {} }), { kind: "not_delivered" }],
    ["403", axiosError({ status: 403, data: {} }), { kind: "unexpected", status: Some(403) }],
    ["no response", axiosError(), { kind: "network" }],
  ])("maps %s", async (_, error, expected) => {
    vi.mocked(sessionGuard.post).mockRejectedValue(error);
    const result = await CoachingSessionApi.resendInvite("s-1");
    expect(result._unsafeUnwrapErr()).toEqual(expected);
  });
});
