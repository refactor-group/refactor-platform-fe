"use client";

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useCurrentCoachingRelationship } from './use-current-coaching-relationship';
import { RelationshipRole } from '@/types/relationship-role';

/**
 * Centralized hook for determining the current user's role in the active coaching relationship.
 * Provides relationship-specific role information for contextual UI logic.
 * 
 * Note: This differs from the global `isACoach` flag which indicates if the user 
 * is a coach in ANY relationship across the organization.
 * 
 * @returns Object containing current relationship role information
 */
export const useCurrentUserRole = () => {
  const { userSession } = useAuthStore((state) => ({ userSession: state.userSession }));
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();
  
  return useMemo(() => {
    const isCoachInCurrentRelationship = currentCoachingRelationship?.coach_id === userSession?.id;
    
    return {
      // Current relationship-specific role (for presence indicators, session UI)
      relationship_role: isCoachInCurrentRelationship ? RelationshipRole.Coach : RelationshipRole.Coachee,
      
      // Boolean flags for current relationship context
      isCoachInCurrentRelationship,
      isCoacheeInCurrentRelationship: !isCoachInCurrentRelationship,
      
      // Additional context for current relationship
      hasActiveRelationship: !!currentCoachingRelationship,
      relationshipId: currentCoachingRelationship?.id,
      userId: userSession?.id,
      
      // Coach/coachee IDs for current relationship
      coachId: currentCoachingRelationship?.coach_id,
      coacheeId: currentCoachingRelationship?.coachee_id,
    };
  }, [currentCoachingRelationship, userSession?.id]);
};