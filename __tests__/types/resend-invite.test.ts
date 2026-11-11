import { describe, it, expect } from "vitest";
import { ResendInviteRefusal, toResendInviteFailure } from "@/types/resend-invite";
import { Some } from "@/types/option";

const conflict = (details: Record<string, unknown>) =>
  Object.assign(new Error("Request failed with status code 409"), {
    isAxiosError: true,
    response: { status: 409, statusText: "", data: { details }, headers: {}, config: {} },
  });

describe("toResendInviteFailure", () => {
  it("keeps a refusal because the coachee left, with the error for the toast", () => {
    const error = conflict({ reason: "coachee_not_a_member", organization_id: "org-1" });
    expect(toResendInviteFailure(error)).toEqual({ kind: "not_a_member", error });
  });

  it("still reads the existing refusals", () => {
    expect(toResendInviteFailure(conflict({ reason: "series_member" }))).toEqual({
      kind: "refused",
      reason: ResendInviteRefusal.SeriesMember,
    });
  });

  it("treats an unknown 409 as unexpected", () => {
    expect(toResendInviteFailure(conflict({ reason: "something_new" }))).toEqual({
      kind: "unexpected",
      status: Some(409),
    });
  });
});
