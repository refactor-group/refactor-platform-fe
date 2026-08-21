import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { OrganizationSwitcher } from '@/components/ui/organization-switcher'
import { TestProviders } from '@/test-utils/providers'

const { ORGANIZATIONS } = vi.hoisted(() => ({
  ORGANIZATIONS: [
    { id: 'org-1', name: 'Acme Corp', logo: '/logo1.png' },
    { id: 'org-2', name: 'Beta Inc', logo: '/logo2.png' },
  ],
}))

// Mock the organization list hook. useOrganization resolves by id, as the real
// hook does, so the trigger reflects whichever organization is selected.
vi.mock('@/lib/api/organizations', () => ({
  useOrganizationList: () => ({
    organizations: ORGANIZATIONS,
    isLoading: false,
    isError: false,
  }),
  useOrganization: (id: string) => ({
    organization: ORGANIZATIONS.find((org) => org.id === id) ?? null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })
}))

// Mock the sidebar hook
import { SidebarState } from '@/types/sidebar'

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({
    state: SidebarState.Expanded,
    userIntent: SidebarState.Expanded,
    isResponsiveOverride: false,
    isMobile: false,
    setOpenMobile: vi.fn(),
  })
}))

// Mock scrollIntoView
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
})

// The label carries the current organization once one is selected, and the
// placeholder before that.
const getTrigger = () => screen.getByRole('button', { name: /organization/i })

// The trigger renders the selected organization's name as well, so assertions
// about the menu have to be scoped to it to stay unambiguous.
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(getTrigger())
  return screen.findByRole('menu')
}

describe('OrganizationSwitcher', () => {
  it('should render with default state', () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    expect(getTrigger()).toBeInTheDocument()
  })

  it('should show organizations when clicked', async () => {
    const user = userEvent.setup()
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const menu = await openMenu(user)

    expect(within(menu).getByRole('menuitem', { name: /Acme Corp/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Beta Inc/ })).toBeInTheDocument()
  })

  it('should call onSelect when organization is selected', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <TestProviders>
        <OrganizationSwitcher onSelect={onSelect} />
      </TestProviders>
    )

    const menu = await openMenu(user)
    await user.click(within(menu).getByRole('menuitem', { name: /Acme Corp/ }))

    expect(onSelect).toHaveBeenCalledWith('org-1')
  })

  it('shows the selected organization\'s initials on the trigger avatar', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    // Auto-initializes to the first organization, Acme Corp.
    const trigger = getTrigger()
    await waitFor(() => {
      expect(within(trigger).getByText('AC')).toBeInTheDocument()
    })
    expect(within(trigger).queryByText('RG')).not.toBeInTheDocument()
  })

  it('updates the trigger avatar initials when a different organization is selected', async () => {
    const user = userEvent.setup()
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const trigger = getTrigger()
    await waitFor(() => {
      expect(within(trigger).getByText('AC')).toBeInTheDocument()
    })

    const menu = await openMenu(user)
    await user.click(within(menu).getByRole('menuitem', { name: /Beta Inc/ }))

    await waitFor(() => {
      expect(within(trigger).getByText('BI')).toBeInTheDocument()
    })
    expect(within(trigger).queryByText('AC')).not.toBeInTheDocument()
  })

  it('gives each organization in the list its own initials', async () => {
    const user = userEvent.setup()
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const menu = await openMenu(user)

    expect(within(menu).getByText('AC')).toBeInTheDocument()
    expect(within(menu).getByText('BI')).toBeInTheDocument()
  })

  // Keyboard support comes from the menu primitive rather than a hand-rolled
  // key handler, so this guards the wiring, not the behaviour of Radix.
  it('opens from the keyboard and lands on the first organization', async () => {
    const user = userEvent.setup()
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    getTrigger().focus()
    await user.keyboard('{Enter}')

    const menu = await screen.findByRole('menu')
    await waitFor(() => {
      expect(within(menu).getByRole('menuitem', { name: /Acme Corp/ })).toHaveFocus()
    })
  })
})
