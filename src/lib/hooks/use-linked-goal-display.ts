import { useMemo } from "react";
import type { Action } from "@/types/action";
import type { Goal } from "@/types/goal";
import { goalTitle as getGoalTitle } from "@/types/goal";
import { useGoal, useGoalsBySession } from "@/lib/api/goals";

/**
 * Resolves the linked goal title for an action and ensures goals are available
 * for the goal picker, even when no `goals` prop is provided.
 *
 * @param action - The action whose linked goal to resolve
 * @param goals  - Pre-fetched session goals (optional; when absent, goals are
 *                 lazy-fetched via SWR so the goal picker still works)
 * @returns `linkedGoalId` for callbacks, `linkedGoalTitle` for display,
 *          and `resolvedGoals` for the picker
 */
export function useLinkedGoalDisplay(
  action: Action,
  goals?: Goal[]
): {
  linkedGoalId: string | undefined;
  linkedGoalTitle: string | undefined;
  resolvedGoals: Goal[] | undefined;
} {
  const linkedGoalId = action.goal_id.some ? action.goal_id.val : undefined;

  // Prefer the goals array if provided (session panel); otherwise lazy-fetch
  // the single goal by ID (kanban board / any context without pre-fetched goals).
  const goalFromArray = useMemo(() => {
    if (!linkedGoalId || !goals) return undefined;
    return goals.find((g) => g.id === linkedGoalId);
  }, [linkedGoalId, goals]);

  const shouldFetchGoal = Boolean(linkedGoalId) && !goalFromArray;
  const { goal: fetchedGoal } = useGoal(shouldFetchGoal ? linkedGoalId! : "");

  const linkedGoalTitle = useMemo(() => {
    if (goalFromArray) return getGoalTitle(goalFromArray);
    if (shouldFetchGoal && fetchedGoal.id) return getGoalTitle(fetchedGoal);
    return undefined;
  }, [goalFromArray, shouldFetchGoal, fetchedGoal]);

  // When no goals prop is provided (e.g. kanban board), lazy-fetch session
  // goals so the edit form's goal picker still works. SWR skips the fetch
  // when the key is null (goals already provided via prop).
  const { goals: sessionGoals } = useGoalsBySession(
    !goals ? action.coaching_session_id : null
  );
  const resolvedGoals = goals ?? (sessionGoals.length > 0 ? sessionGoals : undefined);

  return { linkedGoalId, linkedGoalTitle, resolvedGoals };
}
