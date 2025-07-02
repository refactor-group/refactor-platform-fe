"use client";

import { useOrganization } from "@/lib/api/organizations";
import { useSimpleOrganizationStateStore } from "@/lib/providers/simple-organization-state-store-provider";

/**
 * Hook that combines simple organization state store with SWR organization data.
 * Provides the current organization ID from the store and fetches the full organization
 * data using SWR when an ID is set.
 * 
 * @returns Object containing current organization ID, full organization data, loading state, and error state
 */
export const useCurrentOrganization = () => {
  const { currentOrganizationId, setCurrentOrganizationId, resetOrganizationState } = 
    useSimpleOrganizationStateStore((state) => state);

  // Fetch organization data using SWR (only if currentOrganizationId exists)
  const { organization, isLoading, isError, refresh } = useOrganization(currentOrganizationId || "");

  return {
    // Current organization ID from simple store
    currentOrganizationId,
    
    // Full organization data from SWR (null if no ID set)
    currentOrganization: currentOrganizationId ? organization : null,
    
    // Loading and error states from SWR
    isLoading: currentOrganizationId ? isLoading : false,
    isError: currentOrganizationId ? isError : false,
    
    // Actions
    setCurrentOrganizationId,
    resetOrganizationState,
    refresh,
  };
};