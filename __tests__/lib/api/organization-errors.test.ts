import { describe, it, expect } from "vitest";
import { EntityApiError } from "@/types/entity-api-error";
import {
  organizationArchivedMessage,
  organizationNameTakenMessage,
  organizationNotEmptyMessage,
  organizationNameInvalidMessage,
  validateOrganizationName,
  ORGANIZATION_NAME_MAX_LENGTH,
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

describe("organizationNameInvalidMessage (422 validation_error)", () => {
  it("returns the backend message on a 422 validation_error", () => {
    const err = apiError(422, {
      error: "validation_error",
      message: "Organization name must not be empty.",
    });
    expect(organizationNameInvalidMessage(err)).toBe(
      "Organization name must not be empty."
    );
  });

  it("falls back to a default when the 422 has no message", () => {
    const err = apiError(422, { error: "validation_error" });
    expect(organizationNameInvalidMessage(err)).toBe(
      "Please enter a valid organization name."
    );
  });

  it("ignores a validation_error that isn't a 422", () => {
    const err = apiError(409, { error: "validation_error", message: "x" });
    expect(organizationNameInvalidMessage(err)).toBeNull();
  });

  it("ignores a 422 that isn't validation_error, and non-errors", () => {
    const other = apiError(422, { error: "cannot_link_completed_goal", message: "x" });
    expect(organizationNameInvalidMessage(other)).toBeNull();
    expect(organizationNameInvalidMessage(new Error("boom"))).toBeNull();
    expect(organizationNameInvalidMessage(undefined)).toBeNull();
  });

  it("does not collide with the 409 name-taken discriminator", () => {
    const nameTaken = apiError(409, {
      error: "organization_name_taken",
      message: "taken",
    });
    expect(organizationNameInvalidMessage(nameTaken)).toBeNull();
  });
});

describe("validateOrganizationName", () => {
  it("accepts a normal name", () => {
    expect(validateOrganizationName("Acme")).toBeNull();
  });

  it("rejects empty / whitespace-only names", () => {
    expect(validateOrganizationName("")).toBe(
      "Organization name must not be empty."
    );
    expect(validateOrganizationName("   ")).toBe(
      "Organization name must not be empty."
    );
  });

  it(`accepts exactly ${ORGANIZATION_NAME_MAX_LENGTH} chars and rejects one more`, () => {
    expect(
      validateOrganizationName("a".repeat(ORGANIZATION_NAME_MAX_LENGTH))
    ).toBeNull();
    expect(
      validateOrganizationName("a".repeat(ORGANIZATION_NAME_MAX_LENGTH + 1))
    ).toBe(
      `Organization name must be at most ${ORGANIZATION_NAME_MAX_LENGTH} characters (got ${
        ORGANIZATION_NAME_MAX_LENGTH + 1
      }).`
    );
  });

  it("trims before measuring length", () => {
    const padded = `  ${"a".repeat(ORGANIZATION_NAME_MAX_LENGTH)}  `;
    expect(validateOrganizationName(padded)).toBeNull();
  });
});
