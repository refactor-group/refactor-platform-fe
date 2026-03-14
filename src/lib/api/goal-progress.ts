// Goal progress API — dedicated module mirroring backend's goal_progress module pattern.

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  GoalProgress,
  GoalProgressMetrics,
  parseGoalProgressMetrics,
} from "@/types/goal-progress";
import { type Option, None } from "@/types/option";
import { EntityApi } from "./entity-api";

const GOALS_BASEURL: string = `${siteConfig.env.backendServiceURL}/goals`;

/** Default metrics returned while loading or when no data is available. */
function defaultGoalProgressMetrics(): GoalProgressMetrics {
  return {
    actions_completed: 0,
    actions_total: 0,
    linked_session_count: 0,
    progress: GoalProgress.SolidMomentum,
    last_session_date: None,
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
      () => goalId.some ? GoalProgressApi.get(goalId.val) : Promise.reject("unreachable"),
      defaultGoalProgressMetrics()
    );

  return {
    progressMetrics: entity,
    isLoading,
    isError,
    refresh,
  };
};
