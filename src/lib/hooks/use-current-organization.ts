"use client";

import { useOrganization } from "@/lib/api/organizations";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";

/**
 * Hook that provides current organization state and data.
 * Tracks the active organization ID and fetches the full organization
 * data using SWR when an ID is available.
 * 
 * @returns Object containing current organization ID, full organization data, loading state, and error state
 */
export const useCurrentOrganization = () => {
  const { currentOrganizationId, setCurrentOrganizationId, resetOrganizationState } = 
    useOrganizationStateStore((state) => state);

  // Fetch organization data using SWR (only if currentOrganizationId exists)
  const { organization, isLoading, isError, refresh } = useOrganization(currentOrganizationId || "");

  return {
    // Current organization ID
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