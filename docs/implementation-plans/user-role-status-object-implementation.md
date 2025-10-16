# User Role Status Object Implementation Plan

## Overview
Transform `useCurrentUserRole` from throwing errors to returning a status object pattern, providing better UX through toast notifications for error cases.

## Current State Analysis

### Files Using `useCurrentUserRole`:
1. `src/components/ui/members/member-card.tsx` (lines 4, 65, 80, 156, 168)
2. `src/components/ui/members/member-container.tsx` (lines 7, 29, 51, 68)

### Files Using `getUserRoleForOrganization`:
1. `src/lib/hooks/use-current-user-role.ts` (line 26)

### Current Role Checks Pattern:
- Direct equality comparisons: `currentUserRole === Role.Admin`
- Multiple role checks: `currentUserRole === Role.Admin || currentUserRole === Role.SuperAdmin`
- Permission gates in JSX: `{(condition) && <Component />}`

---

## Implementation Plan

### Phase 1: Core Type & Function Updates

#### 1.1 Update Type Definitions (`src/types/user.ts`)

**File:** `src/types/user.ts`

**Changes:**
```typescript
// Add new discriminated union type
export type UserRoleState =
  | { status: 'success'; role: Role; hasAccess: true }
  | { status: 'no_roles'; role: null; hasAccess: false; reason: 'USER_HAS_NO_ROLES' }
  | { status: 'no_access'; role: null; hasAccess: false; reason: 'NO_ORG_ACCESS'; organizationId: string }
  | { status: 'no_org_selected'; role: null; hasAccess: false; reason: 'NO_ORG_SELECTED' };

// Update getUserRoleForOrganization to return Role | null
export function getUserRoleForOrganization(
  roles: UserRole[],
  organizationId: Id | null
): Role | null {
  // Check for SuperAdmin (global access)
  const superAdminRole = roles.find(
    (r) => r.role === Role.SuperAdmin && r.organization_id === null
  );
  if (superAdminRole) {
    return Role.SuperAdmin;
  }

  // Find role matching the current organization
  const orgRole = roles.find((r) => r.organization_id === organizationId);
  return orgRole?.role ?? null;
}
```

**Location:** Lines 5-12 (after UserRole interface), Lines 118-140 (replace existing function)

---

#### 1.2 Update Hook Implementation (`src/lib/hooks/use-current-user-role.ts`)

**File:** `src/lib/hooks/use-current-user-role.ts`

**Changes:**
```typescript
import { useMemo, useEffect } from 'react';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useCurrentOrganization } from './use-current-organization';
import { getUserRoleForOrganization, Role, UserRoleState } from '@/types/user';
import { toast } from 'sonner';

/**
 * Hook to get the current user's role for the current organization.
 * Returns a status object with role information and access state.
 *
 * Shows toast notifications for error cases:
 * - 'no_roles': System error, user shouldn't be logged in
 * - 'no_org_selected': User needs to select an organization
 * - 'no_access': User doesn't have access to current organization
 */
export const useCurrentUserRole = (): UserRoleState => {
  const { userSession } = useAuthStore((state) => ({ userSession: state.userSession }));
  const { currentOrganizationId } = useCurrentOrganization();

  const roleState = useMemo((): UserRoleState => {
    // System error: user shouldn't be logged in without roles
    if (!userSession?.roles || userSession.roles.length === 0) {
      return {
        status: 'no_roles',
        role: null,
        hasAccess: false,
        reason: 'USER_HAS_NO_ROLES'
      };
    }

    // Legitimate case: no organization selected yet
    if (!currentOrganizationId) {
      return {
        status: 'no_org_selected',
        role: null,
        hasAccess: false,
        reason: 'NO_ORG_SELECTED'
      };
    }

    // Try to get role for current organization
    const role = getUserRoleForOrganization(userSession.roles, currentOrganizationId);

    if (role !== null) {
      return {
        status: 'success',
        role,
        hasAccess: true
      };
    }

    // User doesn't have access to this organization
    return {
      status: 'no_access',
      role: null,
      hasAccess: false,
      reason: 'NO_ORG_ACCESS',
      organizationId: currentOrganizationId
    };
  }, [userSession?.roles, currentOrganizationId]);

  // Show toast notifications for error states (only once per state change)
  useEffect(() => {
    if (roleState.status === 'no_roles') {
      toast.error('System error: No roles assigned. Please contact support.');
    } else if (roleState.status === 'no_org_selected') {
      toast.info('Please select an organization to continue.');
    } else if (roleState.status === 'no_access') {
      toast.warning(`You don't have access to this organization.`);
    }
  }, [roleState.status]);

  return roleState;
};
```

**Location:** Replace entire file contents

---

### Phase 2: Component Updates

#### 2.1 Update `member-card.tsx`

**File:** `src/components/ui/members/member-card.tsx`

**Changes:**

```typescript
// Line 4: Update import
import { useCurrentUserRole } from "@/lib/hooks/use-current-user-role";
import { User, Role } from "@/types/user";

// Line 65: Update hook usage
const currentUserRoleState = useCurrentUserRole();

// Line 76-81: Update canDeleteUser logic
const canDeleteUser =
  currentUserRoleState.hasAccess &&
  (
    (userRelationships?.some(
      (rel) => rel.coach_id === userSession.id && userId !== userSession.id
    ) ||
      currentUserRoleState.role === Role.Admin) &&
    userSession.id !== userId
  );

// Line 156: Update condition
{(isACoach ||
  (currentUserRoleState.hasAccess &&
   (currentUserRoleState.role === Role.Admin || currentUserRoleState.role === Role.SuperAdmin))) && (

// Line 168: Update nested condition
{currentUserRoleState.hasAccess &&
 (currentUserRoleState.role === Role.Admin || currentUserRoleState.role === Role.SuperAdmin) && (
```

**Locations:**
- Line 4: Import update
- Line 65: Variable name change
- Lines 76-81: Permission check update
- Line 156: JSX condition update
- Line 168: JSX nested condition update

---

#### 2.2 Update `member-container.tsx`

**File:** `src/components/ui/members/member-container.tsx`

**Changes:**

```typescript
// Line 7: Import already correct, no change needed

// Line 29: Update hook usage
const currentUserRoleState = useCurrentUserRole();

// Lines 50-53: Update displayUsers logic
const displayUsers = (
  currentUserRoleState.hasAccess &&
  (currentUserRoleState.role === Role.Admin || currentUserRoleState.role === Role.SuperAdmin)
)
  ? users
  : users.filter((user) => associatedUserIds.has(user.id));

// Line 68: Update condition
{(isACoach ||
  (currentUserRoleState.hasAccess &&
   (currentUserRoleState.role === Role.Admin || currentUserRoleState.role === Role.SuperAdmin))) && (
```

**Locations:**
- Line 29: Variable name change
- Lines 50-53: Filter logic update
- Line 68: JSX condition update

---

### Phase 3: Test Updates

#### 3.1 Update `use-current-user-role.test.tsx`

**File:** `__tests__/hooks/use-current-user-role.test.tsx`

**Changes:**
```typescript
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCurrentUserRole } from '@/lib/hooks/use-current-user-role';
import { TestProviders } from '@/test-utils/providers';
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

    const { result } = renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

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

    const { result } = renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

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

    const { result } = renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

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

    const { result } = renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

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
      currentOrganizationId: 'org-2',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    const { result } = renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

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
      } as User
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

    expect(mockToast.error).toHaveBeenCalledWith('System error: No roles assigned. Please contact support.');
  });

  it('should show toast notification for no_org_selected state', () => {
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

    renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

    expect(mockToast.info).toHaveBeenCalledWith('Please select an organization to continue.');
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
      } as User
    });

    mockUseCurrentOrganization.mockReturnValue({
      currentOrganizationId: 'org-2',
      setCurrentOrganizationId: vi.fn(),
      resetOrganizationState: vi.fn()
    });

    renderHook(() => useCurrentUserRole(), {
      wrapper: TestProviders
    });

    expect(mockToast.warning).toHaveBeenCalledWith("You don't have access to this organization.");
  });
});
```

**Location:** Replace entire file

---

#### 3.2 Update `user.test.ts`

**File:** `__tests__/types/user.test.ts`

**Changes:**
```typescript
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
```

**Location:** Replace entire file

---

#### 3.3 Update `user-roles.integration.test.tsx`

**File:** `__tests__/integration/user-roles.integration.test.tsx`

**Changes:** Update all test expectations to match status object pattern. Each test should expect:
```typescript
expect(result.current).toEqual({
  status: 'success',
  role: Role.Admin,
  hasAccess: true
});
```

Instead of:
```typescript
expect(result.current).toBe(Role.Admin);
```

**Location:** Update all assertions throughout the file

---

### Phase 4: Helper Utilities (Optional)

#### 4.1 Create Role Check Helpers

**File:** `src/lib/utils/role-helpers.ts` (NEW FILE)

```typescript
import { UserRoleState, Role } from '@/types/user';

/**
 * Helper to check if user has specific role
 */
export function hasRole(roleState: UserRoleState, role: Role): boolean {
  return roleState.hasAccess && roleState.role === role;
}

/**
 * Helper to check if user has any of the specified roles
 */
export function hasAnyRole(roleState: UserRoleState, roles: Role[]): boolean {
  return roleState.hasAccess && roleState.role !== null && roles.includes(roleState.role);
}

/**
 * Helper to check if user is admin or super admin
 */
export function isAdminOrSuperAdmin(roleState: UserRoleState): boolean {
  return hasAnyRole(roleState, [Role.Admin, Role.SuperAdmin]);
}

/**
 * Helper to get role or null
 */
export function getRoleOrNull(roleState: UserRoleState): Role | null {
  return roleState.hasAccess ? roleState.role : null;
}
```

**Usage in components:**
```typescript
import { isAdminOrSuperAdmin } from '@/lib/utils/role-helpers';

// Instead of:
{(currentUserRoleState.hasAccess &&
  (currentUserRoleState.role === Role.Admin || currentUserRoleState.role === Role.SuperAdmin)) && (

// Use:
{isAdminOrSuperAdmin(currentUserRoleState) && (
```

---

## Implementation Checklist

### Phase 1: Core Updates
- [ ] Update `UserRoleState` type in `src/types/user.ts`
- [ ] Update `getUserRoleForOrganization` function in `src/types/user.ts`
- [ ] Update `useCurrentUserRole` hook in `src/lib/hooks/use-current-user-role.ts`

### Phase 2: Component Updates
- [ ] Update `src/components/ui/members/member-card.tsx`
  - [ ] Line 65: Variable name
  - [ ] Lines 76-81: Permission check
  - [ ] Line 156: JSX condition
  - [ ] Line 168: Nested JSX condition
- [ ] Update `src/components/ui/members/member-container.tsx`
  - [ ] Line 29: Variable name
  - [ ] Lines 50-53: Filter logic
  - [ ] Line 68: JSX condition

### Phase 3: Test Updates
- [ ] Update `__tests__/hooks/use-current-user-role.test.tsx`
- [ ] Update `__tests__/types/user.test.ts`
- [ ] Update `__tests__/integration/user-roles.integration.test.tsx`
- [ ] Run all tests: `npm test`

### Phase 4: Optional Helpers
- [ ] Create `src/lib/utils/role-helpers.ts`
- [ ] Refactor components to use helpers (optional)
- [ ] Create tests for helpers

### Phase 5: Verification
- [ ] Run TypeScript compiler: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Run all tests: `npm test`
- [ ] Manual testing:
  - [ ] User with no roles (should show error toast)
  - [ ] User with no org selected (should show info toast)
  - [ ] User accessing unauthorized org (should show warning toast)
  - [ ] User with proper access (no toast, normal behavior)
  - [ ] SuperAdmin accessing any org (normal behavior)

---

## Migration Notes

### Breaking Changes
- `useCurrentUserRole()` now returns `UserRoleState` instead of `Role`
- `getUserRoleForOrganization()` now returns `Role | null` instead of throwing

### Backward Compatibility
Not applicable - this is a breaking change. All usage sites must be updated.

### Rollback Plan
1. Revert changes to `src/types/user.ts`
2. Revert changes to `src/lib/hooks/use-current-user-role.ts`
3. Revert component changes
4. Revert test changes

---

## Testing Strategy

### Unit Tests
- Test all four status states: `success`, `no_roles`, `no_org_selected`, `no_access`
- Test toast notifications are triggered correctly
- Test `getUserRoleForOrganization` returns null instead of throwing

### Integration Tests
- Test organization switching with different roles
- Test SuperAdmin access to any organization
- Test unauthorized access attempts
- Test profile updates maintaining correct role state
---

## Success Criteria

1. ✅ No TypeScript errors
2. ✅ All tests passing
3. ✅ Toast notifications appear for error cases
4. ✅ No component crashes from error states
5. ✅ User experience is smooth with clear error messages
6. ✅ SuperAdmin access works globally
7. ✅ Regular users see appropriate permissions