import { useState, useMemo, useEffect, useCallback } from "react";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { ItemStatus } from "@/types/general";

/**
 * Manages optimistic status overrides for kanban actions so cards move to
 * their target column immediately, without waiting for the API round-trip.
 *
 * - `applyOverride(id, status)` — sets an optimistic status for the given action
 * - `rollbackOverride(id)` — removes the override (e.g. on API failure)
 * - `actionsWithOverrides` — the actions array with overrides applied
 *
 * Overrides are automatically cleaned up once the real data (from SWR
 * revalidation) reflects the new status.
 */
export function useOptimisticStatus(actions: AssignedActionWithContext[]) {
  const [overrides, setOverrides] = useState<Map<string, ItemStatus>>(
    () => new Map()
  );

  // Clear overrides once the real data catches up
  useEffect(() => {
    if (overrides.size === 0) return;
    const next = new Map<string, ItemStatus>();
    for (const [id, status] of overrides) {
      const action = actions.find((a) => a.action.id === id);
      // Keep override only while the real status hasn't caught up
      if (action && action.action.status !== status) {
        next.set(id, status);
      }
    }
    if (next.size !== overrides.size) {
      setOverrides(next);
    }
  }, [actions, overrides]);

  const applyOverride = useCallback((id: string, status: ItemStatus) => {
    setOverrides((prev) => new Map(prev).set(id, status));
  }, []);

  const rollbackOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const actionsWithOverrides = useMemo(() => {
    if (overrides.size === 0) return actions;
    return actions.map((ctx) => {
      const override = overrides.get(ctx.action.id);
      if (override && override !== ctx.action.status) {
        return { ...ctx, action: { ...ctx.action, status: override } };
      }
      return ctx;
    });
  }, [actions, overrides]);

  return { actionsWithOverrides, applyOverride, rollbackOverride };
}
