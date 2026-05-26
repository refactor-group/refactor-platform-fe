import { describe, it, expect } from "vitest";
import { EntityApiError } from "@/types/general";
import {
  DurationErrorCode,
  isDurationValidationError,
  validateDurationMinutes,
} from "@/types/coaching-session-duration";

function makeEntityApiError(status: number, data: unknown): EntityApiError {
  const axiosLikeError = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Error", data },
  });
  return new EntityApiError("PUT", "/coaching_sessions/1", axiosLikeError);
}

describe("validateDurationMinutes", () => {
  it("rejects zero (below MIN_DURATION_MINUTES)", () => {
    expect(validateDurationMinutes(0)).not.toBeNull();
  });

  it("accepts 1 (the minimum)", () => {
    expect(validateDurationMinutes(1)).toBeNull();
  });

  it("accepts 60 (typical default)", () => {
    expect(validateDurationMinutes(60)).toBeNull();
  });

  it("accepts 480 (the maximum)", () => {
    expect(validateDurationMinutes(480)).toBeNull();
  });

  it("rejects 481 (above MAX_DURATION_MINUTES)", () => {
    expect(validateDurationMinutes(481)).not.toBeNull();
  });

  it("rejects negative values", () => {
    expect(validateDurationMinutes(-30)).not.toBeNull();
  });

  it("rejects non-integer values", () => {
    expect(validateDurationMinutes(1.5)).not.toBeNull();
  });

  it("rejects NaN", () => {
    expect(validateDurationMinutes(NaN)).not.toBeNull();
  });
});

describe("isDurationValidationError", () => {
  it("returns false for a non-EntityApiError value", () => {
    expect(isDurationValidationError(new Error("plain"))).toBe(false);
    expect(isDurationValidationError(null)).toBe(false);
    expect(isDurationValidationError(undefined)).toBe(false);
  });

  it("returns false for an EntityApiError with non-422 status", () => {
    const err = makeEntityApiError(500, {
      status_code: 500,
      error: "validation_error",
      message: "should not match",
    });
    expect(isDurationValidationError(err)).toBe(false);
  });

  it("returns false for a 422 with a different error discriminator", () => {
    const err = makeEntityApiError(422, {
      status_code: 422,
      error: "cannot_link_completed_goal",
      message: "wrong discriminator",
    });
    expect(isDurationValidationError(err)).toBe(false);
  });

  it("returns true for a 422 with the validation_error discriminator", () => {
    const err = makeEntityApiError(422, {
      status_code: 422,
      error: DurationErrorCode.ValidationError,
      message: "duration_minutes must be between 1 and 480 (got 481)",
    });
    expect(isDurationValidationError(err)).toBe(true);
  });

  it("returns false for a 422 with no body", () => {
    const err = makeEntityApiError(422, null);
    expect(isDurationValidationError(err)).toBe(false);
  });
});
