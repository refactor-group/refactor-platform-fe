// Goal progress API — dedicated module mirroring backend's goal_progress module pattern.

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  GoalProgress,
  GoalProgressMetrics,
  GoalWithProgress,
  parseGoalProgressMetrics,
  parseGoalProgressResponse,
} from "@/types/goal-progress";
import { type Option, None } from "@/types/option";
import { EntityApi } from "./entity-api";

const GOALS_BASEURL: string = `${siteConfig.env.backendServiceURL}/goals`;
const ORGANIZATIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/organizations`;

/** Default metrics returned while loading or when no data is available. */
function defaultGoalProgressMetrics(): GoalProgressMetrics {
  return {
    actions_completed: 0,
    actions_total: 0,
    linked_coaching_session_count: 0,
    progress: GoalProgress.SolidMomentum,
    last_coaching_session_date: None,
    next_action_due: None,
  };
}

export const GoalProgressApi = {
  /** Fetches progress metrics for a single goal. */
  get: async (goalId: Id): Promise<GoalProgressMetrics> => {
    const raw = await EntityApi.getFn<unknown>(
      `${GOALS_BASEURL}/${goalId}/progress`
    );
    return parseGoalProgressMetrics(raw);
  },

  /** Fetches progress metrics for all goals in a coaching relationship. */
  listByRelationship: async (
    organizationId: Id,
    relationshipId: Id
  ): Promise<GoalWithProgress[]> => {
    const raw = await EntityApi.getFn<unknown>(
      `${ORGANIZATIONS_BASEURL}/${organizationId}/coaching_relationships/${relationshipId}/goal_progress`
    );
    return parseGoalProgressResponse(raw);
  },
};

/**
 * SWR hook that fetches progress metrics for a single goal.
 * Passes None to skip the fetch (SWR conditional fetching).
 *
 * @param goalId Option wrapping the goal ID — None skips the fetch.
 */
export const useGoalProgress = (goalId: Option<Id>) => {
  // SWR uses null key to skip fetching; unwrap Option at the boundary
  const url = goalId.some ? `${GOALS_BASEURL}/${goalId.val}/progress` : null;

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<GoalProgressMetrics>(
      url,
      () => goalId.some ? GoalProgressApi.get(goalId.val) : Promise.reject(new Error("unreachable: goalId is None")),
      defaultGoalProgressMetrics()
    );

  return {
    progressMetrics: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * SWR hook that fetches progress metrics for all goals in a coaching relationship.
 * Skips the fetch when either ID is null (SWR conditional fetching).
 *
 * @param organizationId The organization ID — null skips the fetch.
 * @param relationshipId The coaching relationship ID — null skips the fetch.
 */
export const useGoalProgressList = (
  organizationId: Id | null,
  relationshipId: Id | null
) => {
  const url =
    organizationId && relationshipId
      ? `${ORGANIZATIONS_BASEURL}/${organizationId}/coaching_relationships/${relationshipId}/goal_progress`
      : null;

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<GoalWithProgress>(
      url ?? "",
      () =>
        GoalProgressApi.listByRelationship(organizationId!, relationshipId!),
      organizationId && relationshipId ? relationshipId : undefined
    );

  return {
    goalsWithProgress: entities,
    isLoading,
    isError,
    refresh,
  };
};
