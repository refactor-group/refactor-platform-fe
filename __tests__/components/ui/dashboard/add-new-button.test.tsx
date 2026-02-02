import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddNewButton } from '@/components/ui/dashboard/add-new-button';
import { useCurrentUserRole } from '@/lib/hooks/use-current-user-role';
import { useCurrentOrganization } from '@/lib/hooks/use-current-organization';
import { isAdminOrSuperAdmin, Role } from '@/types/user';
import type { UserRoleState } from '@/types/user';

// Mock the hooks
vi.mock('@/lib/hooks/use-current-user-role');
vi.mock('@/lib/hooks/use-current-organization');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock auth store with configurable return value
const mockAuthStore = vi.fn();
vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector(mockAuthStore()),
}));

describe('AddNewButton', () => {
  const mockUseCurrentUserRole = vi.mocked(useCurrentUserRole);
  const mockUseCurrentOrganization = vi.mocked(useCurrentOrganization);
  const mockOnCreateSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn(),
    });
  });

  describe('Role-based button visibility', () => {
    it('should hide button entirely for coachee-only user (not a coach, not an admin)', () => {
      const userRoleState: UserRoleState = {
        status: 'success',
        role: Role.User,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(userRoleState);
      mockAuthStore.mockReturnValue({ isACoach: false });

      render(<AddNewButton onCreateSession={mockOnCreateSession} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should show button for coach-only user (not admin)', () => {
      const userRoleState: UserRoleState = {
        status: 'success',
        role: Role.User,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(userRoleState);
      mockAuthStore.mockReturnValue({ isACoach: true });

      render(<AddNewButton onCreateSession={mockOnCreateSession} />);

      expect(screen.getByRole('button', { name: /add new/i })).toBeInTheDocument();
    });

    it('should show button for admin non-coach user', () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);
      mockAuthStore.mockReturnValue({ isACoach: false });

      render(<AddNewButton onCreateSession={mockOnCreateSession} />);

      expect(screen.getByRole('button', { name: /add new/i })).toBeInTheDocument();
    });

    it('should show button for admin coach user', () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);
      mockAuthStore.mockReturnValue({ isACoach: true });

      render(<AddNewButton onCreateSession={mockOnCreateSession} />);

      expect(screen.getByRole('button', { name: /add new/i })).toBeInTheDocument();
    });

    it('should show button for SuperAdmin coach user', () => {
      const superAdminRoleState: UserRoleState = {
        status: 'success',
        role: Role.SuperAdmin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(superAdminRoleState);
      mockAuthStore.mockReturnValue({ isACoach: true });

      render(<AddNewButton onCreateSession={mockOnCreateSession} />);

      expect(screen.getByRole('button', { name: /add new/i })).toBeInTheDocument();
    });

    it('should show button for SuperAdmin non-coach user', () => {
      const superAdminRoleState: UserRoleState = {
        status: 'success',
        role: Role.SuperAdmin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(superAdminRoleState);
      mockAuthStore.mockReturnValue({ isACoach: false });

      render(<AddNewButton onCreateSession={mockOnCreateSession} />);

      expect(screen.getByRole('button', { name: /add new/i })).toBeInTheDocument();
    });

    it('should disable button when no organization is selected', () => {
      const adminRoleState: UserRoleState = {
        status: 'success',
        role: Role.Admin,
        hasAccess: true,
      };
      mockUseCurrentUserRole.mockReturnValue(adminRoleState);
      mockAuthStore.mockReturnValue({ isACoach: true });
      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: null,
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn(),
      });

      render(<AddNewButton onCreateSession={mockOnCreateSession} />);

      const button = screen.getByRole('button', { name: /add new/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  describe('Permission logic (isAdminOrSuperAdmin)', () => {
    // Test the underlying permission logic that determines menu options
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
  });
});
