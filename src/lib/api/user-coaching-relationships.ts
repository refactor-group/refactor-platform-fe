/**
 * Unified API for fetching coaching relationships for a user.
 *
 * Replaces the old separate endpoints:
 * - GET /users/{id}/coach-relationships
 * - GET /users/{id}/coachee-relationships
 * - GET /users/{id}/relationship-roles-summary (derived from response)
 *
 * New unified endpoint: GET /users/{user_id}/coaching-relationships?role={all|coach|coachee}
 */

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { EntityApi } from "./entity-api";

const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * Role filter for user coaching relationships query.
 * - All: Returns all relationships where user is coach OR coachee
 * - Coach: Only relationships where user is the coach
 * - Coachee: Only relationships where user is the coachee
 */
export enum UserCoachingRelationshipRole {
  All = "all",
  Coach = "coach",
  Coachee = "coachee",
}

/**
 * Query parameters for the unified user coaching relationships endpoint.
 */
export interface UserCoachingRelationshipsParams {
  role?: UserCoachingRelationshipRole;
}

/**
 * Builds URL query string from parameters.
 */
function buildQueryString(params?: UserCoachingRelationshipsParams): string {
  if (!params?.role || params.role === UserCoachingRelationshipRole.All) {
    return "";
  }
  return `?role=${params.role}`;
}

/**
 * API client for the unified user coaching relationships endpoint.
 */
export const UserCoachingRelationshipsApi = {
  /**
   * Fetches coaching relationships for a specific user.
   *
   * @param userId The ID of the user
   * @param params Optional query parameters (role filter)
   * @returns Promise resolving to an array of CoachingRelationshipWithUserNames
   */
  list: async (
    userId: Id,
    params?: UserCoachingRelationshipsParams
  ): Promise<CoachingRelationshipWithUserNames[]> => {
    const queryString = buildQueryString(params);
    return EntityApi.listFn<CoachingRelationshipWithUserNames>(
      `${USERS_BASEURL}/${userId}/coaching-relationships${queryString}`,
      { params: { user_id: userId, ...params } }
    );
  },
};

/**
 * Hook to fetch coaching relationships for a specific user.
 *
 * @param userId The ID of the user. If null, no fetch will occur.
 * @param params Optional query parameters (role filter)
 * @returns Object containing relationships, loading state, error state, and refresh function
 */
export const useUserCoachingRelationships = (
  userId: Id | null,
  params?: UserCoachingRelationshipsParams
) => {
  const queryString = buildQueryString(params);
  const url = userId
    ? `${USERS_BASEURL}/${userId}/coaching-relationships${queryString}`
    : null;

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<CoachingRelationshipWithUserNames>(
      url ?? "",
      () =>
        userId
          ? UserCoachingRelationshipsApi.list(userId, params)
          : Promise.resolve([]),
      userId ? { user_id: userId, ...params } : null
    );

  return {
    relationships: entities,
    isLoading,
    isError,
    refresh,
  };
};

// ============================================================================
// Role Summary Utilities (derived from relationships)
// ============================================================================

/**
 * Summary of a user's coaching roles derived from their relationships.
 */
export interface UserCoachingRolesSummary {
  isCoach: boolean;
  isCoachee: boolean;
  coachRelationshipCount: number;
  coacheeRelationshipCount: number;
}

/**
 * Derives role summary from a list of relationships for a given user.
 *
 * @param userId The ID of the user
 * @param relationships The user's coaching relationships
 * @returns Summary of the user's coaching roles
 */
export function deriveRolesSummary(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): UserCoachingRolesSummary {
  const coachRelationships = relationships.filter((r) => r.coach_id === userId);
  const coacheeRelationships = relationships.filter(
    (r) => r.coachee_id === userId
  );

  return {
    isCoach: coachRelationships.length > 0,
    isCoachee: coacheeRelationships.length > 0,
    coachRelationshipCount: coachRelationships.length,
    coacheeRelationshipCount: coacheeRelationships.length,
  };
}

/**
 * Hook to fetch a user's coaching role summary.
 * This replaces the old /relationship-roles-summary endpoint.
 *
 * @param userId The ID of the user. If null, no fetch will occur.
 * @returns Object containing role flags, counts, loading state, and error state
 */
export const useUserCoachingRoles = (userId: Id | null) => {
  const { relationships, isLoading, isError, refresh } =
    useUserCoachingRelationships(userId);

  const summary = userId
    ? deriveRolesSummary(userId, relationships)
    : {
        isCoach: false,
        isCoachee: false,
        coachRelationshipCount: 0,
        coacheeRelationshipCount: 0,
      };

  return {
    ...summary,
    relationships,
    isLoading,
    isError,
    refresh,
  };
};
