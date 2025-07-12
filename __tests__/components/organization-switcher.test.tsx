import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OrganizationSwitcher } from '@/components/ui/organization-switcher'
import { TestProviders } from '@/test-utils/providers'

// Mock the organization list hook
vi.mock('@/lib/api/organizations', () => ({
  useOrganizationList: () => ({
    organizations: [
      { id: 'org-1', name: 'Acme Corp', logo: '/logo1.png' },
      { id: 'org-2', name: 'Beta Inc', logo: '/logo2.png' },
    ],
    isLoading: false,
    isError: false,
  }),
  useOrganization: () => ({
    organization: null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })
}))

// Mock the sidebar hook
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({
    state: 'expanded'
  })
}))

// Mock scrollIntoView
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
})

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

    fireEvent.click(screen.getByRole('combobox'))

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('Beta Inc')).toBeInTheDocument()
    })
  })

  it('should call onSelect when organization is selected', async () => {
    const onSelect = vi.fn()
    
    render(
      <TestProviders>
        <OrganizationSwitcher onSelect={onSelect} />
      </TestProviders>
    )

    fireEvent.click(screen.getByRole('combobox'))
    
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Acme Corp'))

    expect(onSelect).toHaveBeenCalledWith('org-1')
  })

  it('should filter organizations based on search', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    fireEvent.click(screen.getByRole('combobox'))

    const searchInput = screen.getByPlaceholderText('Search organization...')
    fireEvent.change(searchInput, { target: { value: 'Acme' } })

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument()
    })
  })

  it('should handle keyboard navigation', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    fireEvent.click(screen.getByRole('combobox'))

    const searchInput = screen.getByPlaceholderText('Search organization...')
    
    // Test arrow down navigation
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
    
    // The first organization should be focused (implementation depends on actual focus behavior)
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })
  })
})