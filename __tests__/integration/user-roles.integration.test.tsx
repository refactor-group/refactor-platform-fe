import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCurrentUserRole } from '@/lib/hooks/use-current-user-role';
import { useCurrentOrganization } from '@/lib/hooks/use-current-organization';
import { TestProviders } from '@/test-utils/providers';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { Role } from '@/types/user';
import type { UserRole, User } from '@/types/user';

vi.mock('@/lib/providers/auth-store-provider');
vi.mock('@/lib/hooks/use-current-organization');

describe('User Role Integration Tests', () => {
  const mockUseAuthStore = vi.mocked(useAuthStore);
  const mockUseCurrentOrganization = vi.mocked(useCurrentOrganization);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User switching between organizations with different roles', () => {
    it('should return correct role when switching from User to Admin organization', () => {
      const userRoleOrg1: UserRole = {
        id: 'role-1',
        user_id: 'user-1',
        role: Role.User,
        organization_id: 'org-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      const adminRoleOrg2: UserRole = {
        id: 'role-2',
        user_id: 'user-1',
        role: Role.Admin,
        organization_id: 'org-2',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles: [userRoleOrg1, adminRoleOrg2]
        } as User
      });

      let currentOrgId = 'org-1';
      const setCurrentOrganizationId = vi.fn((orgId: string) => {
        currentOrgId = orgId;
      });

      mockUseCurrentOrganization.mockImplementation(() => ({
        currentOrganizationId: currentOrgId,
        setCurrentOrganizationId,
        resetOrganizationState: vi.fn()
      }));

      const { result, rerender } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      // Initially in org-1 with User role
      expect(result.current).toBe(Role.User);

      // Switch to org-2
      act(() => {
        currentOrgId = 'org-2';
        mockUseCurrentOrganization.mockReturnValue({
          currentOrganizationId: 'org-2',
          setCurrentOrganizationId,
          resetOrganizationState: vi.fn()
        });
      });

      rerender();

      // Should now have Admin role in org-2
      expect(result.current).toBe(Role.Admin);
    });

    it('should handle switching between multiple organizations', () => {
      const roles: UserRole[] = [
        {
          id: 'role-1',
          user_id: 'user-1',
          role: Role.User,
          organization_id: 'org-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        {
          id: 'role-2',
          user_id: 'user-1',
          role: Role.Admin,
          organization_id: 'org-2',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        },
        {
          id: 'role-3',
          user_id: 'user-1',
          role: Role.User,
          organization_id: 'org-3',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ];

      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles
        } as User
      });

      const orgSequence = ['org-1', 'org-2', 'org-3'];
      const expectedRoles = [Role.User, Role.Admin, Role.User];

      orgSequence.forEach((orgId, index) => {
        mockUseCurrentOrganization.mockReturnValue({
          currentOrganizationId: orgId,
          setCurrentOrganizationId: vi.fn(),
          resetOrganizationState: vi.fn()
        });

        const { result } = renderHook(() => useCurrentUserRole(), {
          wrapper: TestProviders
        });

        expect(result.current).toBe(expectedRoles[index]);
      });
    });
  });

  describe('SuperAdmin accessing any organization', () => {
    it('should return SuperAdmin role regardless of current organization', () => {
      const superAdminRole: UserRole = {
        id: 'role-1',
        user_id: 'user-1',
        role: Role.SuperAdmin,
        organization_id: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      const orgRole: UserRole = {
        id: 'role-2',
        user_id: 'user-1',
        role: Role.User,
        organization_id: 'org-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles: [superAdminRole, orgRole]
        } as User
      });

      // Test with org-1
      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-1',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      const { result: result1 } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result1.current).toBe(Role.SuperAdmin);

      // Test with org-2 (no specific role)
      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-2',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      const { result: result2 } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result2.current).toBe(Role.SuperAdmin);
    });

    it('should allow SuperAdmin to access organization without specific role', () => {
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

      // Access any random organization
      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-999',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      const { result } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result.current).toBe(Role.SuperAdmin);
    });
  });

  describe('User attempting to access unauthorized organization', () => {
    it('should throw error when user tries to access organization without role', () => {
      const userRole: UserRole = {
        id: 'role-1',
        user_id: 'user-1',
        role: Role.User,
        organization_id: 'org-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles: [userRole]
        } as User
      });

      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-unauthorized',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      expect(() => {
        renderHook(() => useCurrentUserRole(), {
          wrapper: TestProviders
        });
      }).toThrow('No role found for organization org-unauthorized. User may not have access to this organization.');
    });

    it('should allow access when user is granted role for previously unauthorized organization', () => {
      const initialRole: UserRole = {
        id: 'role-1',
        user_id: 'user-1',
        role: Role.User,
        organization_id: 'org-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      const newRole: UserRole = {
        id: 'role-2',
        user_id: 'user-1',
        role: Role.Admin,
        organization_id: 'org-2',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      // Initially only has access to org-1
      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles: [initialRole]
        } as User
      });

      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-2',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      // Should throw error initially
      expect(() => {
        renderHook(() => useCurrentUserRole(), {
          wrapper: TestProviders
        });
      }).toThrow();

      // Grant access to org-2
      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles: [initialRole, newRole]
        } as User
      });

      // Should now work
      const { result } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result.current).toBe(Role.Admin);
    });
  });

  describe('Profile form submission with new role structure', () => {
    it('should handle user with single organization role', () => {
      const userRole: UserRole = {
        id: 'role-1',
        user_id: 'user-1',
        role: Role.User,
        organization_id: 'org-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          roles: [userRole]
        } as User
      });

      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-1',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      const { result } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result.current).toBe(Role.User);
    });

    it('should handle user role update from User to Admin', () => {
      const userRole: UserRole = {
        id: 'role-1',
        user_id: 'user-1',
        role: Role.User,
        organization_id: 'org-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles: [userRole]
        } as User
      });

      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-1',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      const { result: result1 } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result1.current).toBe(Role.User);

      // Simulate role update
      const adminRole: UserRole = {
        ...userRole,
        role: Role.Admin,
        updated_at: '2024-01-02'
      };

      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          roles: [adminRole]
        } as User
      });

      const { result: result2 } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result2.current).toBe(Role.Admin);
    });

    it('should maintain SuperAdmin role after profile update', () => {
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
          email: 'admin@example.com',
          first_name: 'Jane',
          last_name: 'Admin',
          roles: [superAdminRole]
        } as User
      });

      mockUseCurrentOrganization.mockReturnValue({
        currentOrganizationId: 'org-1',
        setCurrentOrganizationId: vi.fn(),
        resetOrganizationState: vi.fn()
      });

      const { result: result1 } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result1.current).toBe(Role.SuperAdmin);

      // Simulate profile update (name, email, etc.) but role remains
      mockUseAuthStore.mockReturnValue({
        userSession: {
          id: 'user-1',
          email: 'newemail@example.com',
          first_name: 'Jane',
          last_name: 'SuperAdmin',
          roles: [superAdminRole]
        } as User
      });

      const { result: result2 } = renderHook(() => useCurrentUserRole(), {
        wrapper: TestProviders
      });

      expect(result2.current).toBe(Role.SuperAdmin);
    });
  });
});
