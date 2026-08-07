import { describe, it, expect } from 'vitest';
import {
  canAddExistingMembers,
  getUserRoleForOrganization,
  parseUser,
  Role,
} from '@/types/user';
import type { UserRole } from '@/types/user';

describe('parseUser', () => {
  it('falls back to 60 for default_coaching_session_duration_minutes when the upstream payload omits it', () => {
    // Defense-in-depth: BE guarantees the field per CoachingSessionDurationFeature v2,
    // but a stale cache or test fixture might omit it; the parser shouldn't crash.
    const payload = {
      id: 'user-1',
      email: 'jim@example.com',
      password: 'irrelevant',
      first_name: 'Jim',
      last_name: 'Hodapp',
      display_name: 'Jim Hodapp',
      timezone: 'America/Los_Angeles',
      role: Role.User,
      roles: [],
      invite_status: null,
    };
    const user = parseUser(payload);
    expect(user.default_coaching_session_duration_minutes).toBe(60);
  });
});

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

describe('canAddExistingMembers', () => {
  const role = (r: Role, organization_id: string | null): UserRole => ({
    id: `role-${r}-${organization_id}`,
    user_id: 'user-1',
    role: r,
    organization_id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });

  it('is false for an admin of a single organization', () => {
    // Everyone they can look up is already a member there, so the flow can only
    // ever return "already a member".
    expect(canAddExistingMembers([role(Role.Admin, 'org-1')])).toBe(false);
  });

  it('is true for an admin of two organizations', () => {
    expect(
      canAddExistingMembers([role(Role.Admin, 'org-1'), role(Role.Admin, 'org-2')])
    ).toBe(true);
  });

  it('does not count organizations where the user is only a member', () => {
    // Visibility requires Admin in the shared organization, not membership.
    expect(
      canAddExistingMembers([role(Role.Admin, 'org-1'), role(Role.User, 'org-2')])
    ).toBe(false);
  });

  it('counts distinct organizations, not role rows', () => {
    expect(
      canAddExistingMembers([role(Role.Admin, 'org-1'), role(Role.Admin, 'org-1')])
    ).toBe(false);
  });

  it('is true for a super admin holding no organization roles', () => {
    expect(canAddExistingMembers([role(Role.SuperAdmin, null)])).toBe(true);
  });

  it('is false for a plain member and for no roles at all', () => {
    expect(canAddExistingMembers([role(Role.User, 'org-1')])).toBe(false);
    expect(canAddExistingMembers([])).toBe(false);
  });
});
