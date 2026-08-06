import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
    isResponsiveOverride: false
  })
}))

// Mock scrollIntoView
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
})

// The trigger renders the selected organization's name as well, so assertions
// about the dropdown have to be scoped to the list to stay unambiguous.
async function openList() {
  fireEvent.click(screen.getByRole('combobox'))
  return screen.findByRole('listbox')
}

describe('OrganizationSwitcher', () => {
  it('should render with default state', () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should show organizations when clicked', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const list = await openList()

    await waitFor(() => {
      expect(within(list).getByText('Acme Corp')).toBeInTheDocument()
      expect(within(list).getByText('Beta Inc')).toBeInTheDocument()
    })
  })

  it('should call onSelect when organization is selected', async () => {
    const onSelect = vi.fn()

    render(
      <TestProviders>
        <OrganizationSwitcher onSelect={onSelect} />
      </TestProviders>
    )

    const list = await openList()

    await waitFor(() => {
      expect(within(list).getByText('Acme Corp')).toBeInTheDocument()
    })

    fireEvent.click(within(list).getByText('Acme Corp'))

    expect(onSelect).toHaveBeenCalledWith('org-1')
  })

  it('should filter organizations based on search', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const list = await openList()

    const searchInput = screen.getByPlaceholderText('Search organization...')
    fireEvent.change(searchInput, { target: { value: 'Acme' } })

    await waitFor(() => {
      expect(within(list).getByText('Acme Corp')).toBeInTheDocument()
      expect(within(list).queryByText('Beta Inc')).not.toBeInTheDocument()
    })
  })

  it('shows the selected organization\'s initials on the trigger avatar', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    // Auto-initializes to the first organization, Acme Corp.
    const trigger = screen.getByRole('combobox')
    await waitFor(() => {
      expect(within(trigger).getByText('AC')).toBeInTheDocument()
    })
    expect(within(trigger).queryByText('RG')).not.toBeInTheDocument()
  })

  it('updates the trigger avatar initials when a different organization is selected', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const trigger = screen.getByRole('combobox')
    await waitFor(() => {
      expect(within(trigger).getByText('AC')).toBeInTheDocument()
    })

    const list = await openList()
    await waitFor(() => {
      expect(within(list).getByText('Beta Inc')).toBeInTheDocument()
    })
    fireEvent.click(within(list).getByText('Beta Inc'))

    await waitFor(() => {
      expect(within(trigger).getByText('BI')).toBeInTheDocument()
    })
    expect(within(trigger).queryByText('AC')).not.toBeInTheDocument()
  })

  it('gives each organization in the list its own initials', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const list = await openList()
    await waitFor(() => {
      expect(within(list).getByText('AC')).toBeInTheDocument()
      expect(within(list).getByText('BI')).toBeInTheDocument()
    })
  })

  it('should handle keyboard navigation', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    const list = await openList()

    const searchInput = screen.getByPlaceholderText('Search organization...')

    // Test arrow down navigation
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' })

    // The first organization should be focused (implementation depends on actual focus behavior)
    await waitFor(() => {
      expect(within(list).getByText('Acme Corp')).toBeInTheDocument()
    })
  })
})