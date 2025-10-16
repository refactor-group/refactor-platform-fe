"use client";

import { useMemo, useEffect } from 'react';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useCurrentOrganization } from './use-current-organization';
import { getUserRoleForOrganization, UserRoleState } from '@/types/user';
import { toast } from 'sonner';

/**
 * Hook that provides the user's role for the current organization context.
 * Returns a status object with role information and access state instead of throwing errors.
 *
 * This hook automatically handles organization switching and shows appropriate toast notifications
 * for error cases. The returned status object uses TypeScript discriminated unions for type safety.
 *
 * @returns {UserRoleState} A status object with one of four possible states:
 *   - `{ status: 'success', role: Role, hasAccess: true }` - User has valid access
 *   - `{ status: 'no_roles', role: null, hasAccess: false, reason: 'USER_HAS_NO_ROLES' }` - System error, user has no roles
 *   - `{ status: 'no_org_selected', role: null, hasAccess: false, reason: 'NO_ORG_SELECTED' }` - No organization selected yet
 *   - `{ status: 'no_access', role: null, hasAccess: false, reason: 'NO_ORG_ACCESS', organizationId: string }` - User lacks access to current org
 *
 * @remarks
 * - Automatically displays toast notifications for error states
 * - Updates immediately when user switches organizations
 * - SuperAdmin users have access to all organizations
 * - Use `hasAccess` property for quick permission checks
 *
 * @example
 * ```tsx
 * const roleState = useCurrentUserRole();
 *
 * // Check for successful access
 * if (roleState.hasAccess && roleState.role === Role.Admin) {
 *   return <AdminDashboard />;
 * }
 *
 * // Handle error states
 * if (roleState.status === 'no_access') {
 *   return <NoAccessMessage orgId={roleState.organizationId} />;
 * }
 *
 * // Type-safe role checking
 * if (roleState.hasAccess) {
 *   // TypeScript knows roleState.role is Role, not null
 *   const role: Role = roleState.role;
 * }
 * ```
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
      toast.error('No roles assigned. Please contact support.');
    } else if (roleState.status === 'no_org_selected') {
      toast.info('Please select an organization to continue.');
    } else if (roleState.status === 'no_access') {
      toast.warning(`You don't have access to this organization.`);
    }
  }, [roleState.status]);

  return roleState;
};