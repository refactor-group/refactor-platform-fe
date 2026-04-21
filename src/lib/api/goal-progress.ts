// Goal progress API — dedicated module mirroring backend's goal_progress module pattern.

import { siteConfig } from "@/site.config";
import { Id, ItemStatus } from "@/types/general";
import {
  GoalProgress,
  GoalProgressMetrics,
  GoalWithProgress,
  parseGoalProgressMetrics,
  parseGoalProgressResponse,
} from "@/types/goal-progress";
import { type Option, None } from "@/types/option";
import { EntityApi } from "./entity-api";

/**
 * Server-side filter / sort / limit params for GET .../goal_progress.
 * See RelationshipGoalProgress v3 contract.
 *
 * Note: `status` is sent as PascalCase on the wire (e.g. "InProgress") — see
 * the "Status casing caveat" in the contract. `ItemStatus` already uses
 * PascalCase values, so its variants pass through unchanged.
 */
export interface GoalProgressListParams {
  status?: ItemStatus;
  sort_by?: "updated_at" | "status_changed_at" | "created_at";
  sort_order?: "asc" | "desc";
  limit?: number;
}

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

  /**
   * Fetches progress metrics for all goals in a coaching relationship.
   * Optional server-side filter/sort/limit — see RelationshipGoalProgress v3.
   */
  listByRelationship: async (
    organizationId: Id,
    relationshipId: Id,
    params: GoalProgressListParams = {}
  ): Promise<GoalWithProgress[]> => {
    const base = `${ORGANIZATIONS_BASEURL}/${organizationId}/coaching_relationships/${relationshipId}/goal_progress`;
    const raw = await EntityApi.getFn<unknown>(buildUrl(base, params));
    return parseGoalProgressResponse(raw);
  },
};

function buildUrl(base: string, params: GoalProgressListParams): string {
  const qs = new URLSearchParams();
  if (params.status !== undefined) qs.append("status", params.status);
  if (params.sort_by !== undefined) qs.append("sort_by", params.sort_by);
  if (params.sort_order !== undefined) qs.append("sort_order", params.sort_order);
  if (params.limit !== undefined) qs.append("limit", String(params.limit));
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

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
 * @param params Optional server-side filter / sort / limit (RelationshipGoalProgress v3).
 */
export const useGoalProgressList = (
  organizationId: Id | null,
  relationshipId: Id | null,
  params: GoalProgressListParams = {}
) => {
  const url =
    organizationId && relationshipId
      ? buildUrl(
          `${ORGANIZATIONS_BASEURL}/${organizationId}/coaching_relationships/${relationshipId}/goal_progress`,
          params
        )
      : null;

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<GoalWithProgress>(
      url ?? "",
      () =>
        GoalProgressApi.listByRelationship(
          organizationId!,
          relationshipId!,
          params
        ),
      // Cache key scopes on (relationshipId + query params) so SWR refetches
      // when any param changes.
      organizationId && relationshipId
        ? `${relationshipId}|${JSON.stringify(params)}`
        : undefined
    );

  return {
    goalsWithProgress: entities,
    isLoading,
    isError,
    refresh,
  };
};
