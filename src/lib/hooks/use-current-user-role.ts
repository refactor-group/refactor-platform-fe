"use client";

import { useMemo, useEffect } from 'react';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useCurrentOrganization } from './use-current-organization';
import { getUserRoleForOrganization, UserRoleState } from '@/types/user';
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
      toast.error('No roles assigned. Please contact support.');
    } else if (roleState.status === 'no_org_selected') {
      toast.info('Please select an organization to continue.');
    } else if (roleState.status === 'no_access') {
      toast.warning(`You don't have access to this organization.`);
    }
  }, [roleState.status]);

  return roleState;
};