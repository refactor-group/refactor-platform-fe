import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { useCurrentUserRole } from '@/lib/hooks/use-current-user-role';
import { useCurrentOrganization } from '@/lib/hooks/use-current-organization';
import { isAdminOrSuperAdmin, Role } from '@/types/user';
import type { UserRoleState } from '@/types/user';
import { SidebarState } from '@/types/sidebar';
import { SidebarProvider } from '@/lib/providers/sidebar-provider';

// Mock the hooks
vi.mock('@/lib/hooks/use-current-user-role');
vi.mock('@/lib/hooks/use-current-organization');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

// Mock auth store
vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: vi.fn(() => ({
    userId: 'user-123',
    userSession: {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      roles: [],
    },
    isLoggedIn: true,
    setIsACoach: vi.fn(),
  })),
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the organization list hook
vi.mock('@/lib/api/organizations', () => ({
  useOrganizationList: () => ({
    organizations: [
      { id: 'org-1', name: 'Test Org', logo: null },
    ],
    isLoading: false,
    isError: false,
  }),
  useOrganization: () => ({
    organization: null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  }),
}));

// Mock the coaching relationships hook (used by OrganizationSwitcher to set isACoach)
vi.mock('@/lib/api/coaching-relationships', () => ({
  useCoachingRelationshipList: () => ({
    relationships: [],
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  }),
}));

// Mock scrollIntoView
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Wrapper component that provides SidebarProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <SidebarProvider>{children}</SidebarProvider>;
};

describe('AppSidebar Permission Logic', () => {
  const mockUseCurrentUserRole = vi.mocked(useCurrentUserRole);
  const mockUseCurrentOrganization = vi.mocked(useCurrentOrganization);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn(),
    });
  });

  describe('isAdminOrSuperAdmin function used by sidebar', () => {
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

    it('should return false for regular User role', () => {
      const userRoleState: UserRoleState = {
        status: 'success',
        role: Role.User,
        hasAccess: true,
      };
      expect(isAdminOrSuperAdmin(userRoleState)).toBe(false);
    });

    it('should return false when user has no access', () => {
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
  });

  describe('Organization settings visibility based on user role', () => {
    it('should show Organization settings menu for Admin users', () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.getByText('Organization settings')).toBeInTheDocument();
    });

    it('should show Organization settings menu for SuperAdmin users', () => {
      const superAdminRoleState: UserRoleState = {
        status: 'success',
        role: Role.SuperAdmin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(superAdminRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.getByText('Organization settings')).toBeInTheDocument();
    });

    it('should NOT show Organization settings menu for regular User role', () => {
      const userRoleState: UserRoleState = {
        status: 'success',
        role: Role.User,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(userRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.queryByText('Organization settings')).not.toBeInTheDocument();
    });

    it('should NOT show Organization settings menu when user has no access', () => {
      const noAccessRoleState: UserRoleState = {
        status: 'no_access',
        role: null,
        hasAccess: false,
        reason: 'NO_ORG_ACCESS',
        organizationId: 'org-1',
      };
      mockUseCurrentUserRole.mockReturnValue(noAccessRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.queryByText('Organization settings')).not.toBeInTheDocument();
    });

    it('should NOT show Organization settings menu when no organization is selected', () => {
      const noOrgRoleState: UserRoleState = {
        status: 'no_org_selected',
        role: null,
        hasAccess: false,
        reason: 'NO_ORG_SELECTED',
      };
      mockUseCurrentUserRole.mockReturnValue(noOrgRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.queryByText('Organization settings')).not.toBeInTheDocument();
    });
  });

  describe('Members link visibility', () => {
    it('should NOT show Members link for regular users (no Organization settings menu)', () => {
      const userRoleState: UserRoleState = {
        status: 'success',
        role: Role.User,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(userRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.queryByText('Members')).not.toBeInTheDocument();
    });

    it('should show Members link when Organization settings is expanded for Admin', async () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      // Click to expand Organization settings
      const orgSettingsButton = screen.getByText('Organization settings');
      fireEvent.click(orgSettingsButton);

      await waitFor(() => {
        expect(screen.getByText('Members')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard link visibility', () => {
    it('should always show Dashboard link for regular users', () => {
      const userRoleState: UserRoleState = {
        status: 'success',
        role: Role.User,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(userRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should always show Dashboard link for Admin users', () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  describe('Collapsible menu behavior', () => {
    it('should expand and collapse Organization settings menu when clicked', async () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      const orgSettingsButton = screen.getByText('Organization settings');

      // Initially, Members should not be visible (collapsed)
      expect(screen.queryByRole('link', { name: /members/i })).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(orgSettingsButton);

      await waitFor(() => {
        expect(screen.getByText('Members')).toBeInTheDocument();
      });

      // Click again to collapse
      fireEvent.click(orgSettingsButton);

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /members/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Members link URL', () => {
    it('should have correct href with current organization ID', async () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);
      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'test-org-123',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn(),
      });

      render(
        <TestWrapper>
          <AppSidebar />
        </TestWrapper>
      );

      // Expand the menu
      const orgSettingsButton = screen.getByText('Organization settings');
      fireEvent.click(orgSettingsButton);

      await waitFor(() => {
        const membersLink = screen.getByRole('link', { name: /members/i });
        expect(membersLink).toHaveAttribute('href', '/organizations/test-org-123/members');
      });
    });
  });
});
