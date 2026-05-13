import { EntityApiError } from "@/types/general";

// ─── Password-reset error discriminators ───────────────────────────
// Top-level `error` string values returned by structured-error
// responses from password-reset endpoints. Centralized so wire-format
// strings live in one place. See PasswordResetEndpoints v1 on the
// coordination board.

export enum PasswordResetErrorCode {
  /** 400 from /password-reset/validate or /password-reset/complete. */
  InvalidOrExpiredToken = "invalid_or_expired_token",
  /** 429 from /password-reset/request when over the per-email cap. */
  PasswordResetRateLimited = "password_reset_rate_limited",
  /** 422 from /password-reset/complete when password !== confirm_password. */
  ValidationError = "validation_error",
}

/** Payload sent to POST /password-reset/request */
export interface PasswordResetRequestParams {
  email: string;
}

/** Payload sent to POST /password-reset/complete */
export interface PasswordResetCompleteParams {
  token: string;
  password: string;
  confirm_password: string;
}

/** Sanitized response from GET /password-reset/validate — first/last name only. */
export interface PasswordResetValidateData {
  first_name: string;
  last_name: string;
}

/**
 * Discriminated union for the reset-complete page state machine.
 * Mirrors the SetupPageState pattern in src/types/magic-link.ts.
 */
export type PasswordResetPageState =
  | { kind: "validating" }
  | { kind: "ready"; firstName: string; lastName: string }
  | { kind: "submitting"; firstName: string; lastName: string }
  | { kind: "success" }
  | { kind: "error"; message: string };

/**
 * Returns true when the error is a 400 invalid_or_expired_token response
 * from /password-reset/validate or /password-reset/complete. Backend
 * deliberately collapses "doesn't exist", "expired", and "wrong purpose"
 * into one discriminator to avoid leaking a status oracle.
 */
export function isInvalidOrExpiredTokenError(err: unknown): boolean {
  if (!(err instanceof EntityApiError) || err.status !== 400) {
    return false;
  }
  const data = err.data;
  return (
    !!data &&
    typeof data === "object" &&
    (data as { error?: unknown }).error ===
      PasswordResetErrorCode.InvalidOrExpiredToken
  );
}

/**
 * Returns true when the error is a 429 password_reset_rate_limited
 * response from /password-reset/request. Per-email rate cap enforced by
 * the BE (1/60s, 5/24h).
 */
export function isPasswordResetRateLimitedError(err: unknown): boolean {
  if (!(err instanceof EntityApiError) || err.status !== 429) {
    return false;
  }
  const data = err.data;
  return (
    !!data &&
    typeof data === "object" &&
    (data as { error?: unknown }).error ===
      PasswordResetErrorCode.PasswordResetRateLimited
  );
}

/**
 * Returns true when the error is a 422 validation_error response from
 * /password-reset/complete. In v1 this is only ever triggered by
 * password !== confirm_password — the FE blocks this client-side, so
 * server-side hits indicate a tampered or malformed request.
 */
export function isPasswordResetValidationError(err: unknown): boolean {
  if (!(err instanceof EntityApiError) || err.status !== 422) {
    return false;
  }
  const data = err.data;
  return (
    !!data &&
    typeof data === "object" &&
    (data as { error?: unknown }).error ===
      PasswordResetErrorCode.ValidationError
  );
}
