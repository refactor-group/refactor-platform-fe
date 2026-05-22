import { describe, it, expect } from 'vitest'
import { EntityApiError } from '@/types/general'
import {
  isInvalidOrExpiredTokenError,
  isPasswordResetRateLimitedError,
  isPasswordResetValidationError,
  PasswordResetErrorCode,
} from '@/types/password-reset'

function makeEntityApiError(
  status: number,
  data: unknown,
  url = '/password-reset/complete'
): EntityApiError {
  const axiosLikeError = Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, statusText: 'Error', data },
  })
  return new EntityApiError('POST', url, axiosLikeError)
}

describe('isInvalidOrExpiredTokenError', () => {
  // Wire format: PasswordResetEndpoints v1 contract on the coordination board.
  // The 400 is the canonical "token unusable" response across validate + complete.
  // BE deliberately collapses "doesn't exist", "expired", and "wrong purpose"
  // into one discriminator so attackers can't enumerate token state.

  it('returns true for the BE 400 invalid_or_expired_token shape', () => {
    const err = makeEntityApiError(400, {
      status_code: 400,
      error: 'invalid_or_expired_token',
      message: 'This reset link is invalid or has expired. Please request a new one.',
    })
    expect(isInvalidOrExpiredTokenError(err)).toBe(true)
  })

  it('returns true regardless of endpoint that produced it (validate vs complete)', () => {
    const validateErr = makeEntityApiError(
      400,
      { error: 'invalid_or_expired_token' },
      '/password-reset/validate'
    )
    const completeErr = makeEntityApiError(
      400,
      { error: 'invalid_or_expired_token' },
      '/password-reset/complete'
    )
    expect(isInvalidOrExpiredTokenError(validateErr)).toBe(true)
    expect(isInvalidOrExpiredTokenError(completeErr)).toBe(true)
  })

  it('returns false for a 400 with a different error code', () => {
    const err = makeEntityApiError(400, { error: 'something_else' })
    expect(isInvalidOrExpiredTokenError(err)).toBe(false)
  })

  it('returns false for a 401 with the same error code (wrong status)', () => {
    const err = makeEntityApiError(401, { error: 'invalid_or_expired_token' })
    expect(isInvalidOrExpiredTokenError(err)).toBe(false)
  })

  it('returns false for a 422 validation error', () => {
    const err = makeEntityApiError(422, { error: 'validation_error' })
    expect(isInvalidOrExpiredTokenError(err)).toBe(false)
  })

  it('returns false for a 429 rate-limit error', () => {
    const err = makeEntityApiError(429, { error: 'password_reset_rate_limited' })
    expect(isInvalidOrExpiredTokenError(err)).toBe(false)
  })

  it('returns false for a 400 with no body', () => {
    const err = makeEntityApiError(400, null)
    expect(isInvalidOrExpiredTokenError(err)).toBe(false)
  })

  it('returns false for a 400 with non-object body', () => {
    const err = makeEntityApiError(400, 'plain text')
    expect(isInvalidOrExpiredTokenError(err)).toBe(false)
  })

  it('returns false for non-EntityApiError input', () => {
    expect(isInvalidOrExpiredTokenError(new Error('plain'))).toBe(false)
    expect(isInvalidOrExpiredTokenError(null)).toBe(false)
    expect(isInvalidOrExpiredTokenError(undefined)).toBe(false)
  })
})

describe('isPasswordResetRateLimitedError', () => {
  // 429 from POST /password-reset/request when per-email cap is exceeded
  // (BE enforces 1/60s and 5/24h).

  it('returns true for the BE 429 password_reset_rate_limited shape', () => {
    const err = makeEntityApiError(
      429,
      {
        status_code: 429,
        error: 'password_reset_rate_limited',
        message: 'Too many password reset requests. Please wait before trying again.',
      },
      '/password-reset/request'
    )
    expect(isPasswordResetRateLimitedError(err)).toBe(true)
  })

  it('returns false for a 429 with a different error code', () => {
    const err = makeEntityApiError(429, { error: 'too_many_requests' })
    expect(isPasswordResetRateLimitedError(err)).toBe(false)
  })

  it('returns false for a 400 with the same error code (wrong status)', () => {
    const err = makeEntityApiError(400, { error: 'password_reset_rate_limited' })
    expect(isPasswordResetRateLimitedError(err)).toBe(false)
  })

  it('returns false for non-EntityApiError input', () => {
    expect(isPasswordResetRateLimitedError(new Error('plain'))).toBe(false)
    expect(isPasswordResetRateLimitedError(null)).toBe(false)
    expect(isPasswordResetRateLimitedError(undefined)).toBe(false)
  })
})

describe('isPasswordResetValidationError', () => {
  // 422 from POST /password-reset/complete when password !== confirm_password.
  // FE blocks client-side, so server-side hits indicate a tampered request.

  it('returns true for the BE 422 validation_error shape', () => {
    const err = makeEntityApiError(422, {
      status_code: 422,
      error: 'validation_error',
      message: 'Password confirmation does not match',
    })
    expect(isPasswordResetValidationError(err)).toBe(true)
  })

  it('returns false for a 422 with a different error code', () => {
    const err = makeEntityApiError(422, { error: 'cannot_link_completed_goal' })
    expect(isPasswordResetValidationError(err)).toBe(false)
  })

  it('returns false for a 400 invalid_or_expired_token error', () => {
    const err = makeEntityApiError(400, { error: 'invalid_or_expired_token' })
    expect(isPasswordResetValidationError(err)).toBe(false)
  })

  it('returns false for non-EntityApiError input', () => {
    expect(isPasswordResetValidationError(new Error('plain'))).toBe(false)
    expect(isPasswordResetValidationError(null)).toBe(false)
    expect(isPasswordResetValidationError(undefined)).toBe(false)
  })
})

describe('password-reset endpoint error disambiguation', () => {
  // The three structured errors that the password-reset endpoints can
  // emit must be mutually exclusive at the parser level. This suite pins
  // that contract so future BE drift gets caught at FE-test-time, not
  // user-rendering-time.

  const invalidOrExpired400 = {
    status_code: 400,
    error: PasswordResetErrorCode.InvalidOrExpiredToken,
    message: 'invalid or expired',
  }
  const validation422 = {
    status_code: 422,
    error: PasswordResetErrorCode.ValidationError,
    message: 'mismatch',
  }
  const rateLimit429 = {
    status_code: 429,
    error: PasswordResetErrorCode.PasswordResetRateLimited,
    message: 'too many',
  }

  it('isInvalidOrExpiredTokenError matches only the 400 invalid_or_expired_token', () => {
    expect(
      isInvalidOrExpiredTokenError(makeEntityApiError(400, invalidOrExpired400))
    ).toBe(true)
    expect(
      isInvalidOrExpiredTokenError(makeEntityApiError(422, validation422))
    ).toBe(false)
    expect(
      isInvalidOrExpiredTokenError(makeEntityApiError(429, rateLimit429))
    ).toBe(false)
  })

  it('isPasswordResetValidationError matches only the 422 validation_error', () => {
    expect(
      isPasswordResetValidationError(makeEntityApiError(400, invalidOrExpired400))
    ).toBe(false)
    expect(
      isPasswordResetValidationError(makeEntityApiError(422, validation422))
    ).toBe(true)
    expect(
      isPasswordResetValidationError(makeEntityApiError(429, rateLimit429))
    ).toBe(false)
  })

  it('isPasswordResetRateLimitedError matches only the 429 password_reset_rate_limited', () => {
    expect(
      isPasswordResetRateLimitedError(makeEntityApiError(400, invalidOrExpired400))
    ).toBe(false)
    expect(
      isPasswordResetRateLimitedError(makeEntityApiError(422, validation422))
    ).toBe(false)
    expect(
      isPasswordResetRateLimitedError(makeEntityApiError(429, rateLimit429))
    ).toBe(true)
  })
})
