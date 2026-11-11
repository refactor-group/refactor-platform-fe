import { describe, it, expect } from "vitest";
import {
  MembershipRefusalReason,
  RefusedWrite,
  membershipRefusalMessage,
  membershipRefusalOf,
} from "@/lib/membership-refusal";
import { EntityApiError } from "@/types/entity-api-error";
import { None, Some } from "@/types/option";

const axiosError = (status: number, data: unknown) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, statusText: "", data, headers: {}, config: {} },
  });

const entityError = (status: number, data: unknown) =>
  new EntityApiError("POST", "/actions", axiosError(status, data) as unknown as Error);

const refusalBody = (reason: string, extra: Record<string, unknown> = {}) => ({
  status_code: 409,
  error: reason,
  message: "Re-add them to the organization first.",
  details: { reason, organization_id: "org-1", ...extra },
});

describe("membershipRefusalOf", () => {
  it("reads a coachee refusal from an axios error", () => {
    expect(membershipRefusalOf(axiosError(409, refusalBody("coachee_not_a_member", { user_id: "u-1" })))).toEqual(
      Some({
        reason: MembershipRefusalReason.CoacheeNotAMember,
        userId: Some("u-1"),
        organizationId: Some("org-1"),
      })
    );
  });

  it("reads an assignee refusal from an EntityApiError", () => {
    const refusal = membershipRefusalOf(entityError(409, refusalBody("assignee_not_a_member")));
    expect(refusal.some && refusal.val.reason).toBe(MembershipRefusalReason.AssigneeNotAMember);
    expect(refusal.some && refusal.val.userId).toEqual(None);
  });

  it("ignores other 409 reasons", () => {
    expect(membershipRefusalOf(axiosError(409, refusalBody("series_member")))).toEqual(None);
  });

  it("ignores the reason on a status other than 409", () => {
    expect(membershipRefusalOf(axiosError(422, refusalBody("coachee_not_a_member")))).toEqual(None);
  });

  it("ignores errors that aren't HTTP errors", () => {
    expect(membershipRefusalOf(new Error("boom"))).toEqual(None);
  });
});

describe("membershipRefusalMessage", () => {
  it("offers an admin the next step for each write", () => {
    expect(membershipRefusalMessage(RefusedWrite.Schedule, Some("Maya Diaz"), true)).toBe(
      "Maya Diaz is no longer in this organization · Add Maya Diaz back to schedule sessions"
    );
    expect(membershipRefusalMessage(RefusedWrite.Resend, Some("Maya Diaz"), true)).toBe(
      "Maya Diaz is no longer in this organization · Add Maya Diaz back to resend the invite"
    );
    expect(membershipRefusalMessage(RefusedWrite.Assign, Some("Maya Diaz"), true)).toBe(
      "Maya Diaz is no longer in this organization · Add Maya Diaz back to assign actions"
    );
  });

  it("points anyone else at an admin", () => {
    expect(membershipRefusalMessage(RefusedWrite.Schedule, Some("Maya Diaz"), false)).toBe(
      "Maya Diaz is no longer in this organization · Ask an admin to add Maya Diaz back"
    );
  });

  it("still reads naturally without a name", () => {
    expect(membershipRefusalMessage(RefusedWrite.Resend, None, false)).toBe(
      "This person is no longer in this organization · Ask an admin to add this person back"
    );
  });
});
