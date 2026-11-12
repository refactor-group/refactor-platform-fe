import { describe, it, expect } from "vitest";
import { NotAMemberReason, notAMemberRefusalOf } from "@/types/membership";
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

describe("notAMemberRefusalOf", () => {
  it("reads a coachee refusal from an axios error", () => {
    expect(notAMemberRefusalOf(axiosError(409, refusalBody("coachee_not_a_member", { user_id: "u-1" })))).toEqual(
      Some({
        reason: NotAMemberReason.Coachee,
        userId: Some("u-1"),
        organizationId: Some("org-1"),
      })
    );
  });

  it("reads an assignee refusal from an EntityApiError", () => {
    const refusal = notAMemberRefusalOf(entityError(409, refusalBody("assignee_not_a_member")));
    expect(refusal.some && refusal.val.reason).toBe(NotAMemberReason.Assignee);
    expect(refusal.some && refusal.val.userId).toEqual(None);
  });

  it("ignores other 409 reasons", () => {
    expect(notAMemberRefusalOf(axiosError(409, refusalBody("series_member")))).toEqual(None);
  });

  it("ignores the reason on a status other than 409", () => {
    expect(notAMemberRefusalOf(axiosError(422, refusalBody("coachee_not_a_member")))).toEqual(None);
  });

  it("ignores errors that aren't HTTP errors", () => {
    expect(notAMemberRefusalOf(new Error("boom"))).toEqual(None);
  });
});

