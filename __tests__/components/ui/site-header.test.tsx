import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/ui/site-header';

const h = vi.hoisted(() => ({
  setIsACoach: vi.fn(),
}));

vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      userId: 'user-1',
      isLoggedIn: true,
      isACoach: false,
      setIsACoach: h.setIsACoach,
      userSession: {
        id: 'user-1',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        roles: [],
      },
    }),
}));

vi.mock('@/lib/api/organizations', () => ({
  useOrganizationList: () => ({
    organizations: [{ id: 'org-1', name: 'Acme Corp', logo: null }],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/lib/api/coaching-relationships', () => ({
  useCoachingRelationshipList: () => ({
    relationships: [{ id: 'rel-1', coach_id: 'user-1', coachee_id: 'user-2' }],
  }),
}));

vi.mock('@/lib/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: 'org-1',
    currentOrganization: { id: 'org-1', name: 'Acme Corp', logo: null },
    lastOrganizationIdByUser: {},
    setCurrentOrganizationId: vi.fn(),
    rememberOrganizationForUser: vi.fn(),
    forgetOrganizationForUser: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/use-current-user-role', () => ({
  useCurrentUserRole: () => ({ status: 'no_roles', role: null, hasAccess: false, reason: 'USER_HAS_NO_ROLES' }),
}));
vi.mock('@/lib/hooks/use-logout-user', () => ({ useLogoutUser: () => vi.fn() }));
vi.mock('@/lib/providers/coaching-relationship-state-store-provider', () => ({
  useCoachingRelationshipStateStore: (selector: (state: unknown) => unknown) =>
    selector({ currentCoachingRelationshipId: null }),
}));
vi.mock('@/lib/hooks/use-show-session-switcher', () => ({ useShowSessionSwitcher: () => false }));
vi.mock('@/components/ui/search/global-search', () => ({ GlobalSearch: () => null }));

describe('SiteHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/actions');
  });

  it('leads with the current organization, linking to the dashboard', () => {
    render(<SiteHeader />);

    const tile = within(screen.getByRole('banner')).getAllByRole('link')[0];
    expect(tile).toHaveAccessibleName('Acme Corp');
    expect(tile).toHaveTextContent('Acme Corp');
    expect(tile).toHaveAttribute('href', '/dashboard');
  });

  it('marks only the destination matching the current page', () => {
    render(<SiteHeader />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Actions' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks Dashboard on the dashboard', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    render(<SiteHeader />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Actions' })).not.toHaveAttribute('aria-current');
  });

  it('keeps organization state in sync with the account menu closed', () => {
    render(<SiteHeader />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(h.setIsACoach).toHaveBeenCalledWith(true);
  });
});
