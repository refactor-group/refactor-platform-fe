// Goal health API — dedicated module mirroring backend's goal_health module pattern.

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  GoalHealth,
  GoalHealthMetrics,
  parseGoalHealthMetrics,
} from "@/types/goal-health";
import { Option, None } from "ts-results";
import { EntityApi } from "./entity-api";

const GOALS_BASEURL: string = `${siteConfig.env.backendServiceURL}/goals`;

/** Default metrics returned while loading or when no data is available. */
function defaultGoalHealthMetrics(): GoalHealthMetrics {
  return {
    actions_completed: 0,
    actions_total: 0,
    linked_session_count: 0,
    health: GoalHealth.SolidMomentum,
    last_session_date: None,
    next_action_due: None,
  };
}

export const GoalHealthApi = {
  /** Fetches health metrics for a single goal. */
  get: async (goalId: Id): Promise<GoalHealthMetrics> => {
    const raw = await EntityApi.getFn<unknown>(
      `${GOALS_BASEURL}/${goalId}/health`
    );
    return parseGoalHealthMetrics(raw);
  },
};

/**
 * SWR hook that fetches health metrics for a single goal.
 * Passes None to skip the fetch (SWR conditional fetching).
 *
 * @param goalId Option wrapping the goal ID — None skips the fetch.
 */
export const useGoalHealth = (goalId: Option<Id>) => {
  // SWR uses null key to skip fetching; unwrap Option at the boundary
  const url = goalId.some ? `${GOALS_BASEURL}/${goalId.val}/health` : null;

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<GoalHealthMetrics>(
      url,
      () => GoalHealthApi.get(goalId.unwrap()),
      defaultGoalHealthMetrics()
    );

  return {
    healthMetrics: entity,
    isLoading,
    isError,
    refresh,
  };
};
