"use client";

import { useCoachingRelationship } from "@/lib/api/coaching-relationships";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCurrentOrganization } from "./use-current-organization";

/**
 * Hook that provides current coaching relationship state and data.
 * Tracks the active coaching relationship ID and fetches the full relationship
 * data using SWR when both organization ID and relationship ID are available.
 * 
 * @returns Object containing current relationship ID, full relationship data, loading state, and error state
 */
export const useCurrentCoachingRelationship = () => {
  const { currentCoachingRelationshipId, setCurrentCoachingRelationshipId, resetCoachingRelationshipState } = 
    useCoachingRelationshipStateStore((state) => state);

  // Get current organization ID (needed for coaching relationship API calls)
  const { currentOrganizationId } = useCurrentOrganization();

  // Fetch coaching relationship data using SWR (only if both IDs exist)
  const { relationship, isLoading, isError, refresh } = useCoachingRelationship(
    currentOrganizationId || "", 
    currentCoachingRelationshipId || ""
  );

  const hasRequiredIds = !!(currentOrganizationId && currentCoachingRelationshipId);

  return {
    // Current coaching relationship ID
    currentCoachingRelationshipId,
    
    // Full coaching relationship data from SWR (null if no IDs set)
    currentCoachingRelationship: hasRequiredIds ? relationship : null,
    
    // Loading and error states from SWR
    isLoading: hasRequiredIds ? isLoading : false,
    isError: hasRequiredIds ? isError : false,
    
    // Current organization ID (needed for relationship operations)
    currentOrganizationId,
    
    // Actions
    setCurrentCoachingRelationshipId,
    resetCoachingRelationshipState,
    refresh,
  };
};