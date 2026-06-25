import { describe, it, expect } from "vitest";
import { EntityApiError } from "@/types/entity-api-error";
import {
  organizationArchivedMessage,
  organizationNameTakenMessage,
  organizationNotEmptyMessage,
} from "@/lib/api/organization-errors";

function apiError(status: number, data: unknown): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Conflict", data },
  });
  return new EntityApiError("POST", "/organizations", axiosLike);
}

describe("organization error discriminators", () => {
  it("returns the backend message when the error code matches", () => {
    const err = apiError(409, {
      error: "organization_archived",
      message: "This organization is archived and cannot accept new changes.",
    });
    expect(organizationArchivedMessage(err)).toBe(
      "This organization is archived and cannot accept new changes."
    );
  });

  it("falls back to a default message when the matched error has none", () => {
    const err = apiError(409, { error: "organization_archived" });
    expect(organizationArchivedMessage(err)).toBe(
      "This organization is archived and can't accept new changes."
    );
  });

  it("returns null for a different error code", () => {
    const err = apiError(409, { error: "organization_not_empty", message: "x" });
    expect(organizationArchivedMessage(err)).toBeNull();
  });

  it("returns null for non-EntityApiError values", () => {
    expect(organizationArchivedMessage(new Error("boom"))).toBeNull();
    expect(organizationArchivedMessage(undefined)).toBeNull();
  });

  it("each helper only matches its own discriminator", () => {
    const nameTaken = apiError(409, {
      error: "organization_name_taken",
      message: "taken",
    });
    const notEmpty = apiError(409, {
      error: "organization_not_empty",
      message: "not empty",
    });
    expect(organizationNameTakenMessage(nameTaken)).toBe("taken");
    expect(organizationNotEmptyMessage(notEmpty)).toBe("not empty");
    expect(organizationNameTakenMessage(notEmpty)).toBeNull();
    expect(organizationNotEmptyMessage(nameTaken)).toBeNull();
  });
});
