import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ResetPasswordPage from '@/app/reset-password/[token]/page'
import { PasswordResetApi } from '@/lib/api/password-reset'
import { EntityApiError } from '@/types/general'

// next/navigation is already mocked globally in setup.ts; override useParams
const mockUseParams = vi.fn<() => Record<string, string | string[] | undefined>>(() => ({ token: 'valid-token' }))
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('next/navigation')
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  }
})

// Auth store mock — toggle isLoggedIn per test.
const mockAuthState = { isLoggedIn: false, userSession: { email: '' } }
vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: (sel: (s: typeof mockAuthState) => unknown) => sel(mockAuthState),
}))

// Logout hook mock — assert it's called or not called depending on the path.
const mockLogout = vi.fn(() => Promise.resolve())
vi.mock('@/lib/hooks/use-logout-user', () => ({
  useLogoutUser: () => mockLogout,
}))

// API client mock.
vi.mock('@/lib/api/password-reset', () => ({
  PasswordResetApi: {
    validate: vi.fn(),
    complete: vi.fn(),
    request: vi.fn(),
  },
}))

const mockedApi = vi.mocked(PasswordResetApi, true)

function makeApiError(status: number, data: unknown, path = '/password-reset/complete'): EntityApiError {
  const axiosLike = Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, statusText: 'Error', data },
  })
  return new EntityApiError('POST', path, axiosLike)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseParams.mockReturnValue({ token: 'valid-token' })
  mockAuthState.isLoggedIn = false
  mockAuthState.userSession.email = ''
})

describe('ResetPasswordPage — validate step', () => {
  it('shows the validating spinner before validate resolves', () => {
    mockedApi.validate.mockReturnValueOnce(new Promise(() => {})) // never resolves
    render(<ResetPasswordPage />)
    expect(screen.getByText(/Validating your reset link/i)).toBeInTheDocument()
  })

  it('transitions to ready state with personalized greeting on validate success', async () => {
    mockedApi.validate.mockResolvedValueOnce({ first_name: 'Jane', last_name: 'Doe' })
    render(<ResetPasswordPage />)
    expect(await screen.findByText(/Hi Jane, set a new password below/i)).toBeInTheDocument()
  })

  it('transitions to error state on 400 invalid_or_expired_token', async () => {
    mockedApi.validate.mockRejectedValueOnce(
      makeApiError(400, { error: 'invalid_or_expired_token' }, '/password-reset/validate')
    )
    render(<ResetPasswordPage />)
    expect(
      await screen.findByText(/This reset link is invalid or has expired/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Request a new reset link/i })).toBeInTheDocument()
  })

  it('renders error state immediately when token param is missing (no API call)', async () => {
    mockUseParams.mockReturnValue({ token: undefined })
    render(<ResetPasswordPage />)
    expect(
      await screen.findByText(/This reset link is invalid or has expired/i)
    ).toBeInTheDocument()
    expect(mockedApi.validate).not.toHaveBeenCalled()
  })
})

describe('ResetPasswordPage — complete step', () => {
  it('shows the success card after a successful complete (logged-out user)', async () => {
    mockedApi.validate.mockResolvedValueOnce({ first_name: 'Jane', last_name: 'Doe' })
    mockedApi.complete.mockResolvedValueOnce(undefined)

    render(<ResetPasswordPage />)
    await screen.findByText(/Hi Jane, set a new password below/i)

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: 'longenoughpassword' } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: 'longenoughpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /Update password/i }))

    expect(
      await screen.findByText(/Your password has been updated\. Please sign in with your new password/i)
    ).toBeInTheDocument()
    // Logged-out: renders a Link, NOT a button-click-logout path.
    expect(screen.getByRole('link', { name: /Go to Sign In/i })).toBeInTheDocument()
    expect(mockLogout).not.toHaveBeenCalled()
  })

  // Fix #1: logged-in user MUST see the success card before logout. Previously
  // logoutUser() was awaited inside complete()'s success path and its
  // router.replace("/") fired before setPageState({ kind: "success" }) could
  // render — so the success UI was never visible.
  it('shows the success card to a logged-in user (no auto-logout)', async () => {
    mockAuthState.isLoggedIn = true
    mockedApi.validate.mockResolvedValueOnce({ first_name: 'Jane', last_name: 'Doe' })
    mockedApi.complete.mockResolvedValueOnce(undefined)

    render(<ResetPasswordPage />)
    await screen.findByText(/Hi Jane, set a new password below/i)

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: 'longenoughpassword' } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: 'longenoughpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /Update password/i }))

    expect(
      await screen.findByText(/Your password has been updated\. Please sign in with your new password/i)
    ).toBeInTheDocument()
    // Critical: logout has NOT been auto-fired. It runs only on Sign-In click.
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('logs the user out when they click Sign In on the success card (logged-in)', async () => {
    mockAuthState.isLoggedIn = true
    mockedApi.validate.mockResolvedValueOnce({ first_name: 'Jane', last_name: 'Doe' })
    mockedApi.complete.mockResolvedValueOnce(undefined)

    render(<ResetPasswordPage />)
    await screen.findByText(/Hi Jane, set a new password below/i)

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: 'longenoughpassword' } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: 'longenoughpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /Update password/i }))

    const signInBtn = await screen.findByRole('button', { name: /Go to Sign In/i })
    fireEvent.click(signInBtn)
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1))
  })

  it('returns to ready state with inline error on 422 validation_error', async () => {
    mockedApi.validate.mockResolvedValueOnce({ first_name: 'Jane', last_name: 'Doe' })
    mockedApi.complete.mockRejectedValueOnce(
      makeApiError(422, {
        error: 'validation_error',
        message: 'Password must be at least 12 characters',
      })
    )

    render(<ResetPasswordPage />)
    await screen.findByText(/Hi Jane/i)

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: 'longenoughpassword' } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: 'longenoughpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /Update password/i }))

    // Surfaces BE message verbatim.
    expect(
      await screen.findByText(/Password must be at least 12 characters/i)
    ).toBeInTheDocument()
    // Stays on the form (ready state), does NOT transition to the terminal error card.
    expect(screen.getByLabelText("New password")).toBeInTheDocument()
  })

  it('transitions to terminal error state on 400 invalid_or_expired_token from complete', async () => {
    mockedApi.validate.mockResolvedValueOnce({ first_name: 'Jane', last_name: 'Doe' })
    mockedApi.complete.mockRejectedValueOnce(
      makeApiError(400, { error: 'invalid_or_expired_token' })
    )

    render(<ResetPasswordPage />)
    await screen.findByText(/Hi Jane/i)

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: 'longenoughpassword' } })
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: 'longenoughpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /Update password/i }))

    expect(
      await screen.findByText(/This reset link is invalid or has expired/i)
    ).toBeInTheDocument()
    // Form is replaced by the terminal error card.
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Request a new reset link/i })).toBeInTheDocument()
  })
})
