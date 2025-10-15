"use client";

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useCurrentOrganization } from './use-current-organization';
import { getUserRoleForOrganization, Role } from '@/types/user';

/**
 * Hook that provides the user's role for the current organization context.
 *
 * Determines the appropriate role based on:
 * - SuperAdmin users (organization_id === null) have global access
 * - Otherwise, finds the role matching the current organization ID
 *
 * @returns The user's Role for the current organization
 * @throws Error if no matching role is found for the organization
 */
export const useCurrentUserRole = (): Role => {
  const { userSession } = useAuthStore((state) => ({ userSession: state.userSession }));
  const { currentOrganizationId } = useCurrentOrganization();

  return useMemo(() => {
    if (!userSession?.roles || userSession.roles.length === 0) {
      throw new Error('User has no roles assigned');
    }

    return getUserRoleForOrganization(userSession.roles, currentOrganizationId);
  }, [userSession?.roles, currentOrganizationId]);
};
