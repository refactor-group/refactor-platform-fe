"use client";

import { useParams } from "next/navigation";
import { useCoachingSession } from "@/lib/api/coaching-sessions";
import { Id } from "@/types/general";
import type { CoachingSession } from "@/types/coaching-session";
import type { EntityApiError } from "@/types/general";

/**
 * Result type for the useCurrentCoachingSession hook.
 */
export interface UseCurrentCoachingSessionResult {
  /** Current coaching session ID from URL path parameter */
  currentCoachingSessionId: string | null;
  /** Full coaching session data from SWR (null if no ID in URL) */
  currentCoachingSession: CoachingSession | null;
  /** Loading state from SWR */
  isLoading: boolean;
  /** Error state from SWR */
  isError: EntityApiError | false;
  /** Function to refresh/revalidate the session data */
  refresh: () => Promise<CoachingSession | undefined>;
}

/**
 * Hook that gets the current coaching session ID from URL path parameters
 * and fetches the full coaching session data using SWR.
 *
 * URL structure: /coaching-sessions/[id]
 *
 * @returns Object containing current session ID, full session data, loading state, and error state
 */
export const useCurrentCoachingSession = (): UseCurrentCoachingSessionResult => {
  const params = useParams();
  
  // Extract coaching session ID from URL path params (/coaching-sessions/123)
  const currentCoachingSessionId = params.id as Id | undefined;

  // Fetch coaching session data using SWR (only if ID exists)
  const { coachingSession, isLoading, isError, refresh } = useCoachingSession(currentCoachingSessionId || "");

  const hasSessionId = !!currentCoachingSessionId;

  return {
    // Current coaching session ID from URL
    currentCoachingSessionId: currentCoachingSessionId || null,
    
    // Full coaching session data from SWR (null if no ID)
    currentCoachingSession: hasSessionId ? coachingSession : null,
    
    // Loading and error states from SWR
    isLoading: hasSessionId ? isLoading : false,
    isError: hasSessionId ? isError : false,
    
    // Actions
    refresh,
  };
};