import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCurrentUserRole } from '@/lib/hooks/use-current-user-role';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useCurrentOrganization } from '@/lib/hooks/use-current-organization';
import { Role } from '@/types/user';
import type { UserRole, User } from '@/types/user';
import { toast } from 'sonner';

vi.mock('@/lib/providers/auth-store-provider');
vi.mock('@/lib/hooks/use-current-organization');
vi.mock('sonner');

describe('useCurrentUserRole', () => {
  const mockUseAuthStore = vi.mocked(useAuthStore);
  const mockUseCurrentOrganization = vi.mocked(useCurrentOrganization);
  const mockToast = vi.mocked(toast);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return SuperAdmin for users with SuperAdmin role', () => {
    const superAdminRole: UserRole = {
      id: 'role-1',
      user_id: 'user-1',
      role: Role.SuperAdmin,
      organization_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-1',
        roles: [superAdminRole]
      } as User
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    const { result } = renderHook(() => useCurrentUserRole());

    expect(result.current).toEqual({
      status: 'success',
      role: Role.SuperAdmin,
      hasAccess: true
    });
  });

  it('should return org-specific role for regular users', () => {
    const adminRole: UserRole = {
      id: 'role-2',
      user_id: 'user-2',
      role: Role.Admin,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-2',
        roles: [adminRole]
      } as User
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    const { result } = renderHook(() => useCurrentUserRole());

    expect(result.current).toEqual({
      status: 'success',
      role: Role.Admin,
      hasAccess: true
    });
  });

  it('should handle missing roles gracefully', () => {
    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-3',
        roles: []
      } as User
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    const { result } = renderHook(() => useCurrentUserRole());

    expect(result.current).toEqual({
      status: 'no_roles',
      role: null,
      hasAccess: false,
      reason: 'USER_HAS_NO_ROLES'
    });
  });

  it('should handle undefined organizationId', () => {
    const userRole: UserRole = {
      id: 'role-4',
      user_id: 'user-4',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-4',
        roles: [userRole]
      } as User
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: null,
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    const { result } = renderHook(() => useCurrentUserRole());

    expect(result.current).toEqual({
      status: 'no_org_selected',
      role: null,
      hasAccess: false,
      reason: 'NO_ORG_SELECTED'
    });
  });

  it('should handle user with no access to organization', () => {
    const userRole: UserRole = {
      id: 'role-5',
      user_id: 'user-5',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-5',
        roles: [userRole]
      } as User
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-2', // Different organization
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    const { result } = renderHook(() => useCurrentUserRole());

    expect(result.current).toEqual({
      status: 'no_access',
      role: null,
      hasAccess: false,
      reason: 'NO_ORG_ACCESS',
      organizationId: 'org-2'
    });
  });

  it('should show toast notification for no_roles state', () => {
    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-3',
        roles: []
      } as User,
      isLoggedIn: true
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    renderHook(() => useCurrentUserRole());

    expect(mockToast.error).toHaveBeenCalledWith(
      'No roles assigned. Please contact support.',
      { id: 'user-role-no-roles' }
    );
  });

  // Transient by construction — the switcher settles on an organization a tick
  // later, so toasting it just flashes noise on every sign-in.
  it('should stay silent for the no_org_selected state', () => {
    const userRole: UserRole = {
      id: 'role-4',
      user_id: 'user-4',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-4',
        roles: [userRole]
      } as User,
      isLoggedIn: true
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: null,
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    renderHook(() => useCurrentUserRole());

    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it('should show toast notification for no_access state', () => {
    const userRole: UserRole = {
      id: 'role-5',
      user_id: 'user-5',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-5',
        roles: [userRole]
      } as User,
      isLoggedIn: true
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-2',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    renderHook(() => useCurrentUserRole());

    expect(mockToast.warning).toHaveBeenCalledWith(
      "You don't have access to this organization.",
      { id: 'user-role-no-access' }
    );
  });

  // Every consumer of this hook runs the toast effect, so a shared id is what
  // keeps one bad state from stacking a toast per mounted component.
  it('collapses the no_access toast across concurrent consumers', () => {
    const userRole: UserRole = {
      id: 'role-6',
      user_id: 'user-6',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    mockUseAuthStore.mockReturnValue({
      userSession: {
        id: 'user-6',
        roles: [userRole]
      } as User,
      isLoggedIn: true
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-2',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    renderHook(() => useCurrentUserRole());
    renderHook(() => useCurrentUserRole());
    renderHook(() => useCurrentUserRole());

    const ids = mockToast.warning.mock.calls.map(([, options]) => options?.id);
    expect(new Set(ids)).toEqual(new Set(['user-role-no-access']));
  });
});
