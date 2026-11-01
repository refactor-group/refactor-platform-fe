import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SiteHeader } from '@/components/ui/site-header'
import { TestProviders } from '@/test-utils/providers'

const h = vi.hoisted(() => ({
  ORGANIZATIONS: [
    { id: 'org-1', name: 'Acme Corp', logo: '/logo1.png' },
    { id: 'org-2', name: 'Beta Inc', logo: '/logo2.png' },
  ],
  authState: {
    userId: 'user-1',
    isLoggedIn: true,
    isACoach: false,
    setIsACoach: () => {},
    userSession: {
      id: 'user-1',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      roles: [],
    },
  },
  setCurrentOrganizationId: vi.fn(),
  rememberOrganizationForUser: vi.fn(),
}))

// useOrganization resolves by id, as the real hook does, so the header tile
// reflects whichever organization is selected.
vi.mock('@/lib/api/organizations', () => ({
  useOrganizationList: () => ({
    organizations: h.ORGANIZATIONS,
    isLoading: false,
    isError: false,
  }),
  useOrganization: (id: string) => ({
    organization: h.ORGANIZATIONS.find((org) => org.id === id) ?? null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/api/coaching-relationships', () => ({
  useCoachingRelationshipList: () => ({ relationships: [] }),
}))

vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: (selector: (state: typeof h.authState) => unknown) => selector(h.authState),
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// The real organization store, with the two setters observed.
vi.mock('@/lib/hooks/use-current-organization', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-current-organization')>()
  return {
    useCurrentOrganization: () => {
      const current = actual.useCurrentOrganization()
      return {
        ...current,
        setCurrentOrganizationId: (id: string) => {
          h.setCurrentOrganizationId(id)
          current.setCurrentOrganizationId(id)
        },
        rememberOrganizationForUser: (userId: string, orgId: string) => {
          h.rememberOrganizationForUser(userId, orgId)
          current.rememberOrganizationForUser(userId, orgId)
        },
      }
    },
  }
})

vi.mock('@/lib/hooks/use-current-user-role', () => ({
  useCurrentUserRole: () => ({
    status: 'no_org_selected',
    role: null,
    hasAccess: false,
    reason: 'NO_ORG_SELECTED',
  }),
}))
vi.mock('@/lib/hooks/use-logout-user', () => ({ useLogoutUser: () => vi.fn() }))
vi.mock('@/lib/hooks/use-show-session-switcher', () => ({ useShowSessionSwitcher: () => false }))
vi.mock('@/components/ui/search/global-search', () => ({ GlobalSearch: () => null }))

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
})

const getMenuTrigger = () => screen.getByRole('button', { name: 'Account menu' })
// The org tile leads the header.
const getOrgTile = () => within(screen.getByRole('banner')).getAllByRole('link')[0]

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(getMenuTrigger())
  return screen.findByRole('menu')
}

function renderHeader() {
  return render(
    <TestProviders>
      <SiteHeader />
    </TestProviders>
  )
}

describe('UserMenu organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('lists every organization the user belongs to', async () => {
    const user = userEvent.setup()
    renderHeader()

    const menu = await openMenu(user)

    expect(within(menu).getByRole('menuitem', { name: /Acme Corp/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Beta Inc/ })).toBeInTheDocument()
  })

  it('gives each organization in the list its own initials', async () => {
    const user = userEvent.setup()
    renderHeader()

    const menu = await openMenu(user)

    expect(within(menu).getByText('AC')).toBeInTheDocument()
    expect(within(menu).getByText('BI')).toBeInTheDocument()
  })

  it('marks the current organization', async () => {
    const user = userEvent.setup()
    renderHeader()
    // Auto-initializes to the first organization, Acme Corp.
    await waitFor(() => expect(h.setCurrentOrganizationId).toHaveBeenCalledWith('org-1'))

    const menu = await openMenu(user)

    expect(within(menu).getByRole('menuitem', { name: /Acme Corp/ })).toHaveAttribute('aria-current', 'true')
    expect(within(menu).getByRole('menuitem', { name: /Beta Inc/ })).not.toHaveAttribute('aria-current')
  })

  it('switches to and remembers an organization picked from the menu', async () => {
    const user = userEvent.setup()
    renderHeader()

    const menu = await openMenu(user)
    await user.click(within(menu).getByRole('menuitem', { name: /Beta Inc/ }))

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith('org-2')
    expect(h.rememberOrganizationForUser).toHaveBeenCalledWith('user-1', 'org-2')
  })

  it("shows the selected organization's initials on the header tile", async () => {
    renderHeader()

    await waitFor(() => {
      expect(within(getOrgTile()).getByText('AC')).toBeInTheDocument()
    })
    expect(getOrgTile()).toHaveAccessibleName('Acme Corp')
  })

  it('updates the header tile when a different organization is selected', async () => {
    const user = userEvent.setup()
    renderHeader()
    await waitFor(() => {
      expect(within(getOrgTile()).getByText('AC')).toBeInTheDocument()
    })

    const menu = await openMenu(user)
    await user.click(within(menu).getByRole('menuitem', { name: /Beta Inc/ }))

    await waitFor(() => {
      expect(within(getOrgTile()).getByText('BI')).toBeInTheDocument()
    })
    expect(getOrgTile()).toHaveAccessibleName('Beta Inc')
    expect(within(getOrgTile()).queryByText('AC')).not.toBeInTheDocument()
  })

  it('opens from the keyboard and lands on the first organization', async () => {
    const user = userEvent.setup()
    renderHeader()

    getMenuTrigger().focus()
    await user.keyboard('{Enter}')

    const menu = await screen.findByRole('menu')
    const acme = within(menu).getByRole('menuitem', { name: /Acme Corp/ })
    const beta = within(menu).getByRole('menuitem', { name: /Beta Inc/ })
    await waitFor(() => {
      expect(acme).toHaveFocus()
    })

    await user.keyboard('{ArrowDown}')
    expect(beta).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(acme).toHaveFocus()
  })

  it('selects the focused organization on Enter', async () => {
    const user = userEvent.setup()
    renderHeader()

    getMenuTrigger().focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith('org-2')
    expect(h.rememberOrganizationForUser).toHaveBeenCalledWith('user-1', 'org-2')
  })
})
