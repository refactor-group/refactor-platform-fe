import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { PasswordResetApi } from '@/lib/api/password-reset'
import { EntityApiError } from '@/types/general'

vi.mock('axios')
vi.mock('@/site.config', () => ({
  siteConfig: {
    env: {
      backendServiceURL: 'http://localhost:4000',
      backendApiVersion: '1.0.0-beta1',
    },
  },
}))

const mockedAxios = vi.mocked(axios, true)

function makeAxiosError(status: number, data: unknown) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, statusText: 'Error', data },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PasswordResetApi.request', () => {
  it('POSTs the email to /password-reset/request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { status_code: 200, data: null } })

    await PasswordResetApi.request({ email: 'jane@example.com' })

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:4000/password-reset/request',
      { email: 'jane@example.com' },
      expect.objectContaining({
        headers: { 'X-Version': '1.0.0-beta1' },
        timeout: 15000,
      })
    )
  })

  it('rewraps an axios error as EntityApiError with the right path/method', async () => {
    mockedAxios.post.mockRejectedValueOnce(makeAxiosError(429, { error: 'password_reset_rate_limited' }))

    await expect(PasswordResetApi.request({ email: 'a@b.c' })).rejects.toMatchObject({
      name: 'EntityApiError',
      method: 'POST',
      url: '/password-reset/request',
      status: 429,
    })
  })
})

describe('PasswordResetApi.validate (v1.1 — POST with token in body)', () => {
  it('POSTs the token in the JSON body (NOT as a query param)', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status_code: 200, data: { first_name: 'Jane', last_name: 'Doe' } },
    })

    await PasswordResetApi.validate('raw-token-abc123')

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:4000/password-reset/validate',
      { token: 'raw-token-abc123' },
      expect.objectContaining({
        headers: { 'X-Version': '1.0.0-beta1' },
        timeout: 15000,
      })
    )
    // Defense against contract regression: ensure no `params` (query string)
    // was passed alongside, which would put the token back into the URL.
    const config = mockedAxios.post.mock.calls[0][2] as Record<string, unknown>
    expect(config).not.toHaveProperty('params')
  })

  it('unwraps response.data.data to return PasswordResetValidateData', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status_code: 200, data: { first_name: 'Jane', last_name: 'Doe' } },
    })

    const result = await PasswordResetApi.validate('tok')

    expect(result).toEqual({ first_name: 'Jane', last_name: 'Doe' })
  })

  it('does NOT call axios.get (v1.0 transport is forbidden)', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status_code: 200, data: { first_name: 'J', last_name: 'D' } },
    })

    await PasswordResetApi.validate('tok')

    expect(mockedAxios.get).not.toHaveBeenCalled()
  })

  it('rewraps a 400 invalid_or_expired_token as EntityApiError', async () => {
    mockedAxios.post.mockRejectedValueOnce(
      makeAxiosError(400, { error: 'invalid_or_expired_token', message: 'expired' })
    )

    let captured: unknown
    try {
      await PasswordResetApi.validate('tok')
    } catch (err) {
      captured = err
    }

    expect(captured).toBeInstanceOf(EntityApiError)
    expect(captured).toMatchObject({
      method: 'POST',
      url: '/password-reset/validate',
      status: 400,
    })
  })
})

describe('PasswordResetApi.complete', () => {
  it('POSTs the token + password fields to /password-reset/complete', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { status_code: 200, data: null } })

    await PasswordResetApi.complete({
      token: 'tok',
      password: 'verylongpassword',
      confirm_password: 'verylongpassword',
    })

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:4000/password-reset/complete',
      { token: 'tok', password: 'verylongpassword', confirm_password: 'verylongpassword' },
      expect.objectContaining({
        headers: { 'X-Version': '1.0.0-beta1' },
        timeout: 15000,
      })
    )
  })

  it('rewraps a 422 validation_error as EntityApiError', async () => {
    mockedAxios.post.mockRejectedValueOnce(
      makeAxiosError(422, { error: 'validation_error', message: 'Password must be at least 12 characters' })
    )

    await expect(
      PasswordResetApi.complete({ token: 't', password: 'short', confirm_password: 'short' })
    ).rejects.toMatchObject({
      method: 'POST',
      url: '/password-reset/complete',
      status: 422,
    })
  })

  it('rewraps a 400 invalid_or_expired_token as EntityApiError', async () => {
    mockedAxios.post.mockRejectedValueOnce(
      makeAxiosError(400, { error: 'invalid_or_expired_token' })
    )

    await expect(
      PasswordResetApi.complete({ token: 't', password: 'p', confirm_password: 'p' })
    ).rejects.toMatchObject({
      status: 400,
      url: '/password-reset/complete',
    })
  })
})
