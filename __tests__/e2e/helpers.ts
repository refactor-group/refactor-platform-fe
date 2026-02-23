import type { Page, BrowserContext } from '@playwright/test'

// ---------------------------------------------------------------------------
// Mock data – mirrors the real Zustand persist shapes (including version
// numbers) so the stores can rehydrate without migration errors.
// ---------------------------------------------------------------------------

export const MOCK_USER_ID = 'user-123'

/**
 * auth-store lives in localStorage with version 2.
 * `userSession` must be a full User object matching the User interface.
 */
export const AUTH_STORE_STATE = {
  state: {
    userId: MOCK_USER_ID,
    userSession: {
      id: MOCK_USER_ID,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      timezone: 'America/Chicago',
      role: 'User',
      roles: [
        {
          id: 'role-1',
          user_id: MOCK_USER_ID,
          role: 'User',
          organization_id: 'org-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
    },
    isLoggedIn: true,
    isCurrentCoach: false,
    isACoach: true,
  },
  version: 2,
}

/**
 * organization-state-store lives in localStorage with version 2.
 */
export const ORGANIZATION_STORE_STATE = {
  state: { currentOrganizationId: 'org-1' },
  version: 2,
}

export const MOCK_ORGANIZATIONS = [
  { id: 'org-1', name: 'Acme Corp', slug: 'acme-corp' },
]

/** A single coaching relationship matching the CoachingRelationshipWithUserNames type. */
function mockRelationship(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    coach_id: `coach-${id}`,
    coachee_id: `coachee-${id}`,
    organization_id: 'org-1',
    coach_first_name: 'John',
    coach_last_name: 'Doe',
    coachee_first_name: 'Jane',
    coachee_last_name: 'Smith',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

export const SINGLE_RELATIONSHIP = [mockRelationship('rel-1')]

export const MULTIPLE_RELATIONSHIPS = [
  mockRelationship('rel-1'),
  mockRelationship('rel-2', {
    coach_id: 'coach-2',
    coachee_id: 'coachee-2',
    coach_first_name: 'Bob',
    coach_last_name: 'Johnson',
    coachee_first_name: 'Alice',
    coachee_last_name: 'Brown',
  }),
]

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/**
 * Inject auth + org state into localStorage and add a session cookie so the
 * app treats the browser as authenticated.
 *
 * Note: `addInitScript` runs before every page load (including reloads).
 * If a test needs to mutate storage and then reload, it should not call this
 * helper — instead manage the init script and cookies manually.
 */
export async function setupAuthentication(
  page: Page,
  context: BrowserContext
) {
  const authJson = JSON.stringify(AUTH_STORE_STATE)
  const orgJson = JSON.stringify(ORGANIZATION_STORE_STATE)

  await page.addInitScript(
    ({ auth, org }) => {
      localStorage.setItem('auth-store', auth)
      localStorage.setItem('organization-state-store', org)
    },
    { auth: authJson, org: orgJson }
  )

  await context.addCookies([
    {
      name: 'id',
      value: 'mock-session-id-123',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

/**
 * Set up API route mocks that almost every e2e test needs: session validation,
 * organizations list, coaching relationships, and coaching sessions.
 */
export async function mockCommonApiRoutes(
  page: Page,
  options: {
    relationships?: Record<string, unknown>[]
    coachingSessions?: Record<string, unknown>[]
  } = {}
) {
  const { relationships = SINGLE_RELATIONSHIP, coachingSessions = [] } =
    options

  // Route handlers are matched in LIFO order (last registered wins).
  // Register the catch-all first, then more specific patterns.
  //
  // The backend runs at http://localhost:4000 with no /api/ prefix, so
  // route patterns must match that URL structure.

  // Catch-all for any backend requests not handled below (actions,
  // user_coaching_roles, etc.) to prevent hanging requests.
  await page.route('**/localhost:4000/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })

  await page.route('**/users/validate_session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user_id: MOCK_USER_ID, is_valid: true },
      }),
    })
  })

  await page.route('**/coaching_sessions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: coachingSessions }),
    })
  })

  await page.route('**/coaching_relationships**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: relationships }),
    })
  })

  await page.route('**/organizations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ORGANIZATIONS }),
    })
  })
}
