import { describe, it, expect } from 'vitest';
import { getUserRoleForOrganization, Role } from '@/types/user';
import type { UserRole } from '@/types/user';

describe('getUserRoleForOrganization', () => {
  it('should prioritize SuperAdmin role', () => {
    const superAdminRole: UserRole = {
      id: 'role-1',
      user_id: 'user-1',
      role: Role.SuperAdmin,
      organization_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const adminRole: UserRole = {
      id: 'role-2',
      user_id: 'user-1',
      role: Role.Admin,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const roles = [adminRole, superAdminRole];
    const result = getUserRoleForOrganization(roles, 'org-1');

    expect(result).toBe(Role.SuperAdmin);
  });

  it('should find role by organization ID', () => {
    const userRole: UserRole = {
      id: 'role-1',
      user_id: 'user-1',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const adminRole: UserRole = {
      id: 'role-2',
      user_id: 'user-1',
      role: Role.Admin,
      organization_id: 'org-2',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const roles = [userRole, adminRole];
    const result = getUserRoleForOrganization(roles, 'org-2');

    expect(result).toBe(Role.Admin);
  });

  it('should return null for no matching role', () => {
    const userRole: UserRole = {
      id: 'role-1',
      user_id: 'user-1',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const roles = [userRole];
    const result = getUserRoleForOrganization(roles, 'org-2');

    expect(result).toBeNull();
  });

  it('should handle empty roles array', () => {
    const roles: UserRole[] = [];
    const result = getUserRoleForOrganization(roles, 'org-1');

    expect(result).toBeNull();
  });

  it('should handle null organization ID', () => {
    const userRole: UserRole = {
      id: 'role-1',
      user_id: 'user-1',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const roles = [userRole];
    const result = getUserRoleForOrganization(roles, null);

    expect(result).toBeNull();
  });

  it('should return correct role when user has multiple org roles', () => {
    const role1: UserRole = {
      id: 'role-1',
      user_id: 'user-1',
      role: Role.User,
      organization_id: 'org-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const role2: UserRole = {
      id: 'role-2',
      user_id: 'user-1',
      role: Role.Admin,
      organization_id: 'org-2',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const role3: UserRole = {
      id: 'role-3',
      user_id: 'user-1',
      role: Role.User,
      organization_id: 'org-3',
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    };

    const roles = [role1, role2, role3];

    expect(getUserRoleForOrganization(roles, 'org-1')).toBe(Role.User);
    expect(getUserRoleForOrganization(roles, 'org-2')).toBe(Role.Admin);
    expect(getUserRoleForOrganization(roles, 'org-3')).toBe(Role.User);
  });
});
