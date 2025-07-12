"use client";

import { useEffect } from "react";
import { Id } from "@/types/general";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";

/**
 * Custom hook that automatically selects a coaching relationship when:
 * - User has exactly one coaching relationship
 * - No relationship is currently selected
 * - Relationships have finished loading
 * 
 * @param relationships Array of available coaching relationships
 * @param isLoading Whether relationships are currently being loaded
 * @param currentId Currently selected coaching relationship ID
 * @param setCurrentId Function to set the current coaching relationship ID
 * @param onSelect Optional callback fired when auto-selection occurs
 */
export const useAutoSelectSingleRelationship = (
  relationships: CoachingRelationshipWithUserNames[] | undefined,
  isLoading: boolean,
  currentId: Id,
  setCurrentId: (id: Id) => void,
  onSelect?: (relationshipId: Id) => void
) => {
  useEffect(() => {
    if (
      !isLoading &&
      relationships?.length === 1 &&
      !currentId
    ) {
      try {
        const relationshipId = relationships[0].id;
        setCurrentId(relationshipId);
        if (onSelect) {
          onSelect(relationshipId);
        }
      } catch (error) {
        console.error('Auto-selection failed:', error);
        // Fail gracefully - user can still manually select
      }
    }
  }, [relationships, currentId, isLoading, setCurrentId, onSelect]);
};