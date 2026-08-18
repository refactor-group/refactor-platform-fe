import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { isAdminOrSuperAdmin, Role } from '@/types/user';
import type { UserRoleState } from '@/types/user';
import { shouldDenyMembersPageAccess } from '@/app/organizations/[id]/members/access-control';
import MembersPage from '@/app/organizations/[id]/members/page';
import { EntityApiError } from '@/types/entity-api-error';
import { useCurrentOrganization } from '@/lib/hooks/use-current-organization';
import { useCurrentUserRole } from '@/lib/hooks/use-current-user-role';
import { useCoachingRelationshipList } from '@/lib/api/coaching-relationships';
import { useUserList } from '@/lib/api/organizations/users';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    })),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    usePathname: vi.fn(() => '/'),
    useParams: vi.fn(() => ({})),
    notFound: vi.fn(),
  };
});

// Data hooks the members page reads — mocked so the render tests below can drive
// the page into its 403 (ForbiddenError) and generic-error branches. next/navigation
// is already mocked globally in the test setup.
vi.mock('@/lib/hooks/use-current-organization', () => ({
  useCurrentOrganization: vi.fn(),
}));
vi.mock('@/lib/hooks/use-current-user-role', () => ({
  useCurrentUserRole: vi.fn(),
}));
vi.mock('@/lib/api/coaching-relationships', () => ({
  useCoachingRelationshipList: vi.fn(),
}));
vi.mock('@/lib/api/organizations/users', () => ({
  useUserList: vi.fn(),
}));
vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: vi.fn(),
  AuthStoreProvider: ({ children }: { children: ReactNode }) => children,
}));
// The success path renders MemberContainer; stub it so these tests stay focused
// on the page-level error branches (it is never reached in the 403/error cases).
vi.mock('@/components/ui/members/member-container', () => ({
  MemberContainer: () => <div data-testid="member-container" />,
}));

/**
 * Test Suite: Members Page Access Control
 *
 * These tests verify the permission logic used by the members page.
 * The members page should only be accessible to Admin and SuperAdmin users.
 * Regular users should see a 404 error.
 *
 * The actual access control is implemented using `isAdminOrSuperAdmin(currentUserRoleState)`
 * in the members page component. These tests verify that function behaves correctly
 * for all possible role states.
 */
// A real, selector-aware mock: `state.isLoggedIn` is what the sign-out
// tests below flip between renders, and prior tests relied on the old
// (non-selector) mock coincidentally matching every selector's shape.
let mockAuthState: { userSession: { id: string }; isLoggedIn: boolean };

beforeEach(() => {
  mockAuthState = { userSession: { id: 'user-1' }, isLoggedIn: true };
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector(mockAuthState as never)
  );
});

describe('Members Page Access Control Logic', () => {
  describe('isAdminOrSuperAdmin permission check', () => {
    describe('should allow access (returns true)', () => {
      it('should return true for Admin users', () => {
        const adminRoleState: UserRoleState = {
          status: 'success',
          role: Role.Admin,
          hasAccess: true,
        };

        expect(isAdminOrSuperAdmin(adminRoleState)).toBe(true);
      });

      it('should return true for SuperAdmin users', () => {
        const superAdminRoleState: UserRoleState = {
          status: 'success',
          role: Role.SuperAdmin,
          hasAccess: true,
        };

        expect(isAdminOrSuperAdmin(superAdminRoleState)).toBe(true);
      });
    });

    describe('should deny access (returns false) - triggers 404', () => {
      it('should return false for regular User role', () => {
        const userRoleState: UserRoleState = {
          status: 'success',
          role: Role.User,
          hasAccess: true,
        };

        expect(isAdminOrSuperAdmin(userRoleState)).toBe(false);
      });

      it('should return false when user has no access to organization', () => {
        const noAccessRoleState: UserRoleState = {
          status: 'no_access',
          role: null,
          hasAccess: false,
          reason: 'NO_ORG_ACCESS',
          organizationId: 'org-1',
        };

        expect(isAdminOrSuperAdmin(noAccessRoleState)).toBe(false);
      });

      it('should return false when no organization is selected', () => {
        const noOrgRoleState: UserRoleState = {
          status: 'no_org_selected',
          role: null,
          hasAccess: false,
          reason: 'NO_ORG_SELECTED',
        };

        expect(isAdminOrSuperAdmin(noOrgRoleState)).toBe(false);
      });

      it('should return false when user has no roles', () => {
        const noRolesState: UserRoleState = {
          status: 'no_roles',
          role: null,
          hasAccess: false,
          reason: 'USER_HAS_NO_ROLES',
        };

        expect(isAdminOrSuperAdmin(noRolesState)).toBe(false);
      });
    });
  });

  describe('shouldDenyMembersPageAccess', () => {
    const orgId = 'org-123';

    describe('should not deny access (returns false)', () => {
      it('should return false when organization IDs do not match (access check deferred)', () => {
        const adminRoleState: UserRoleState = {
          status: 'success',
          role: Role.Admin,
          hasAccess: true,
        };

        // Different org IDs means we haven't synced yet, so don't deny
        expect(shouldDenyMembersPageAccess('different-org', orgId, adminRoleState, true, true)).toBe(false);
        expect(shouldDenyMembersPageAccess(null, orgId, adminRoleState, true, true)).toBe(false);
      });

      it('should return false for Admin users', () => {
        const adminRoleState: UserRoleState = {
          status: 'success',
          role: Role.Admin,
          hasAccess: true,
        };

        expect(shouldDenyMembersPageAccess(orgId, orgId, adminRoleState, true, true)).toBe(false);
      });

      it('should return false for SuperAdmin users', () => {
        const superAdminRoleState: UserRoleState = {
          status: 'success',
          role: Role.SuperAdmin,
          hasAccess: true,
        };

        expect(shouldDenyMembersPageAccess(orgId, orgId, superAdminRoleState, true, true)).toBe(false);
      });
    });

    describe('should deny access (returns true) - triggers 404', () => {
      it('should return true when user has no access to organization', () => {
        const noAccessRoleState: UserRoleState = {
          status: 'no_access',
          role: null,
          hasAccess: false,
          reason: 'NO_ORG_ACCESS',
          organizationId: orgId,
        };

        expect(shouldDenyMembersPageAccess(orgId, orgId, noAccessRoleState, true, true)).toBe(true);
      });

      it('should return true for regular User role', () => {
        const userRoleState: UserRoleState = {
          status: 'success',
          role: Role.User,
          hasAccess: true,
        };

        expect(shouldDenyMembersPageAccess(orgId, orgId, userRoleState, true, true)).toBe(true);
      });

      it('should return true when no organization is selected', () => {
        const noOrgRoleState: UserRoleState = {
          status: 'no_org_selected',
          role: null,
          hasAccess: false,
          reason: 'NO_ORG_SELECTED',
        };

        expect(shouldDenyMembersPageAccess(orgId, orgId, noOrgRoleState, true, true)).toBe(true);
      });

      it('should return true when user has no roles', () => {
        const noRolesState: UserRoleState = {
          status: 'no_roles',
          role: null,
          hasAccess: false,
          reason: 'USER_HAS_NO_ROLES',
        };

        expect(shouldDenyMembersPageAccess(orgId, orgId, noRolesState, true, true)).toBe(true);
      });
    });

    describe('authentication transitions', () => {
      const noRolesState: UserRoleState = {
        status: 'no_roles',
        role: null,
        hasAccess: false,
        reason: 'USER_HAS_NO_ROLES',
      };
      const noAccessRoleState: UserRoleState = {
        status: 'no_access',
        role: null,
        hasAccess: false,
        reason: 'NO_ORG_ACCESS',
        organizationId: orgId,
      };

      it('does not deny mid-logout: was authenticated this mount, isn\'t now', () => {
        // Signing out clears the session before the redirect lands, so the page
        // re-renders unauthenticated while still mounted. Every role state that
        // would otherwise 404 must stay allowed in that window.
        expect(shouldDenyMembersPageAccess(orgId, orgId, noRolesState, false, true)).toBe(false);
        expect(shouldDenyMembersPageAccess(orgId, orgId, noAccessRoleState, false, true)).toBe(false);
      });

      it('still denies a visitor who was never authenticated this mount', () => {
        // wasLoggedIn=false is what tells a real logout transition apart from
        // a plain unauthenticated visit -- without it the bypass above would
        // let anyone through, not just someone on the way out.
        expect(shouldDenyMembersPageAccess(orgId, orgId, noRolesState, false, false)).toBe(true);
        expect(shouldDenyMembersPageAccess(orgId, orgId, noAccessRoleState, false, false)).toBe(true);
      });
    });
  });
});

/**
 * Test Suite: Members Page — page-level 403 rendering
 *
 * Mirrors the ActionsPageContainer 403 render test. When either the relationships
 * or users fetch returns a 403, the page should short-circuit to <ForbiddenError>
 * (title + shared "view" permission message) rather than the generic error state.
 * This locks in the second page-level 403 path called out in review.
 */
describe('MembersPage - page-level error rendering', () => {
  const adminRoleState: UserRoleState = {
    status: 'success',
    role: Role.Admin,
    hasAccess: true,
  };

  // React 19's `use()` unwraps a thenable synchronously when it is already tagged
  // fulfilled, so the page renders without needing a Suspense boundary in the test.
  function resolvedParams(id: string) {
    const params = Promise.resolve({ id }) as Promise<{ id: string }> & {
      status?: string;
      value?: { id: string };
    };
    params.status = 'fulfilled';
    params.value = { id };
    return params;
  }

  // A real EntityApiError carrying a 403, so the page's real isForbiddenError
  // (instanceof + status check) narrows correctly.
  function forbiddenError(): EntityApiError {
    return new EntityApiError('GET', '/organizations/org-1/users', {
      isAxiosError: true,
      response: { status: 403, statusText: 'Forbidden', data: {} },
    } as never);
  }

  function mockLists(relationshipsError: unknown, usersError: unknown) {
    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: relationshipsError,
      refresh: vi.fn(),
    } as never);
    vi.mocked(useUserList).mockReturnValue({
      users: [],
      isLoading: false,
      isError: usersError,
      refresh: vi.fn(),
    } as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentOrganization).mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
    } as never);
    vi.mocked(useCurrentUserRole).mockReturnValue(adminRoleState);
  });

  it('renders ForbiddenError when the users fetch returns 403', () => {
    mockLists(false, forbiddenError());

    render(<MembersPage params={resolvedParams('org-1')} />);

    expect(screen.getByText('Members Access Denied')).toBeInTheDocument();
    expect(
      screen.getByText(
        "You don't have permission to view this organization's members."
      )
    ).toBeInTheDocument();
  });

  it('renders ForbiddenError when the relationships fetch returns 403', () => {
    mockLists(forbiddenError(), false);

    render(<MembersPage params={resolvedParams('org-1')} />);

    expect(screen.getByText('Members Access Denied')).toBeInTheDocument();
  });

  it('renders the generic error state for a non-403 fetch failure', () => {
    mockLists(false, new Error('boom'));

    render(<MembersPage params={resolvedParams('org-1')} />);

    expect(screen.getByText('Error loading members')).toBeInTheDocument();
    expect(screen.queryByText('Members Access Denied')).not.toBeInTheDocument();
  });
});

/**
 * Test Suite: MembersPage — organization sync during sign-out
 *
 * Regression guard: resetOrganizationState() (run during logout teardown)
 * clears the persisted org id to "". The page's own org-sync effect used to
 * see that as "out of sync with the route" and immediately write the
 * outgoing user's org id right back — defeating the reset. It must stay
 * inert once signed out.
 */
describe('MembersPage - organization sync while signing out', () => {
  const adminRoleState: UserRoleState = {
    status: 'success',
    role: Role.Admin,
    hasAccess: true,
  };

  function resolvedParams(id: string) {
    const params = Promise.resolve({ id }) as Promise<{ id: string }> & {
      status?: string;
      value?: { id: string };
    };
    params.status = 'fulfilled';
    params.value = { id };
    return params;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentUserRole).mockReturnValue(adminRoleState);
    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    } as never);
    vi.mocked(useUserList).mockReturnValue({
      users: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    } as never);
  });

  it('renders nothing rather than the outgoing user\'s roster once signed out', () => {
    // EntityApi.useClearCache() deletes cache entries directly on the SWR
    // Map without notifying subscribers, so `users` here can still be the
    // outgoing user's data for the rest of this render window.
    vi.mocked(useCurrentOrganization).mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
    } as never);
    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    } as never);
    vi.mocked(useUserList).mockReturnValue({
      users: [{ id: 'user-2', first_name: 'Stale', last_name: 'User' }],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    } as never);

    // First render while still authenticated, matching the real sequence
    // (the page was already mounted and rendering data before logout began).
    const { container, rerender } = render(
      <MembersPage params={resolvedParams('org-1')} />
    );

    mockAuthState.isLoggedIn = false;
    rerender(<MembersPage params={resolvedParams('org-1')} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
  });

  it('does not flash a 404 across several re-renders while signing out', () => {
    // Caught live: a single-rerender test isn't enough here. Signing out
    // fires several re-renders in a row while isLoggedIn stays false (org
    // state, coaching relationship state, etc. each reset separately), and
    // an earlier version of this fix (usePrevious, one render of memory)
    // called notFound() starting on the SECOND of those re-renders.
    vi.mocked(useCurrentOrganization).mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
    } as never);

    const { rerender } = render(<MembersPage params={resolvedParams('org-1')} />);
    expect(notFound).not.toHaveBeenCalled();

    mockAuthState.isLoggedIn = false;
    for (let i = 0; i < 4; i++) {
      rerender(<MembersPage params={resolvedParams('org-1')} />);
    }

    expect(notFound).not.toHaveBeenCalled();
  });

  it('does not write the cleared organization id back once signed out', () => {
    const setCurrentOrganizationId = vi.fn();
    vi.mocked(useCurrentOrganization).mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId,
    } as never);

    const { rerender } = render(<MembersPage params={resolvedParams('org-1')} />);
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();

    // The exact logout sequence: the org id clears to "" and isLoggedIn flips
    // to false in the same window, before the redirect lands.
    mockAuthState.isLoggedIn = false;
    vi.mocked(useCurrentOrganization).mockReturnValue({
      currentOrganizationId: '',
      setCurrentOrganizationId,
    } as never);
    rerender(<MembersPage params={resolvedParams('org-1')} />);

    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });
});
