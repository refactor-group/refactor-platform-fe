import { EntityApiError } from "@/types/general";

// ─── Password-reset error discriminators ───────────────────────────
// Top-level `error` string values returned by structured-error
// responses from password-reset endpoints. Centralized so wire-format
// strings live in one place. See PasswordResetEndpoints v1.1 on the
// coordination board.

export enum PasswordResetErrorCode {
  /** 400 from POST /password-reset/validate or POST /password-reset/complete. */
  InvalidOrExpiredToken = "invalid_or_expired_token",
  /** 429 from POST /password-reset/request when over the per-email cap. */
  PasswordResetRateLimited = "password_reset_rate_limited",
  /** 422 from POST /password-reset/complete when password !== confirm_password. */
  ValidationError = "validation_error",
}

/** Structured error body returned by password-reset endpoints. */
interface PasswordResetErrorBody {
  status_code?: number;
  error?: string;
  message?: string;
}

/** Payload sent to POST /password-reset/request */
export interface PasswordResetRequestParams {
  email: string;
}

/** Payload sent to POST /password-reset/validate (v1.1 — body, not query). */
export interface PasswordResetValidateParams {
  token: string;
}

/** Payload sent to POST /password-reset/complete */
export interface PasswordResetCompleteParams {
  token: string;
  password: string;
  confirm_password: string;
}

/** Sanitized response from POST /password-reset/validate — first/last name only. */
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

function hasErrorCode(
  err: unknown,
  expectedStatus: number,
  code: PasswordResetErrorCode
): err is EntityApiError {
  if (!(err instanceof EntityApiError) || err.status !== expectedStatus) {
    return false;
  }
  const data = err.data as PasswordResetErrorBody | null | undefined;
  return !!data && typeof data === "object" && data.error === code;
}

/**
 * Type guard: error is a 400 invalid_or_expired_token from /validate or /complete.
 * Backend collapses "doesn't exist", "expired", and "wrong purpose" into one
 * discriminator to avoid leaking a status oracle.
 */
export function isInvalidOrExpiredTokenError(
  err: unknown
): err is EntityApiError {
  return hasErrorCode(err, 400, PasswordResetErrorCode.InvalidOrExpiredToken);
}

/**
 * Type guard: error is a 429 password_reset_rate_limited from /request.
 * Per-email rate cap enforced by the BE (1/60s, 5/24h).
 */
export function isPasswordResetRateLimitedError(
  err: unknown
): err is EntityApiError {
  return hasErrorCode(
    err,
    429,
    PasswordResetErrorCode.PasswordResetRateLimited
  );
}

/**
 * Type guard: error is a 422 validation_error from /complete. In v1 only
 * triggered by password !== confirm_password — FE blocks this client-side,
 * so server-side hits indicate a tampered or malformed request.
 */
export function isPasswordResetValidationError(
  err: unknown
): err is EntityApiError {
  return hasErrorCode(err, 422, PasswordResetErrorCode.ValidationError);
}
