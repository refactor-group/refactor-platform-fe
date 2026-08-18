import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore, useAuthStoreApi } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionsCardFilterStore } from "@/lib/providers/coaching-sessions-card-filter-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { EntityApi } from "@/lib/api/entity-api";
import { useRouter } from "next/navigation";
import { logoutCleanupRegistry } from "./logout-cleanup-registry";

export function useLogoutUser() {
  const router = useRouter();
  const authStoreApi = useAuthStoreApi();
  const { logout } = useAuthStore((action) => action);
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const { delete: deleteUserSession } = useUserSessionMutation();
  const { resetCoachingRelationshipState } = useCoachingRelationshipStateStore(
    (state) => state
  );
  const resetCoachingSessionsCardFilters = useCoachingSessionsCardFilterStore(
    (s) => s.resetCoachingSessionsCardFilters
  );
  const resetOrganizationState = useOrganizationStateStore(
    (s) => s.resetOrganizationState
  );
  const clearCache = EntityApi.useClearCache();

  return async () => {
    // Reentrancy guard: the 401 auto-cleanup handler (session-guard.ts) and a
    // manual "Log out" click can race -- a request already in flight can
    // still land after the first DELETE invalidates the session, 401, and
    // trigger this same handler again. Read the store directly rather than
    // through the hook so this check is not a render behind; logout() below
    // updates the same store synchronously, so a second call sees it
    // immediately and returns before repeating the backend round trip.
    if (!authStoreApi.getState().isLoggedIn) return;

    // Clear authentication state to prevent re-initialization
    logout();

    // Component cleanup (TipTap providers, etc.). Isolated so that a failure
    // here cannot skip the state teardown below.
    try {
      await logoutCleanupRegistry.executeAll();
    } catch (err) {
      console.error('Component cleanup failed during logout:', err);
    }

    // Local teardown runs before the backend round trip, not after it: it must
    // not be deferred by a slow request or lost entirely if the tab closes
    // mid-logout. The organization selection is the one that matters most —
    // it is persisted to localStorage, so leaving it behind hands the next
    // user on this browser the previous user's organization.
    //
    // Each step is isolated as well as unconditional; the cache walk is the
    // one most able to throw, and it must not strand the resets.
    for (const teardown of [
      resetOrganizationState,
      resetCoachingRelationshipState,
      resetCoachingSessionsCardFilters,
      clearCache,
    ]) {
      try {
        teardown();
      } catch (err) {
        console.error('Logout teardown step failed:', err);
      }
    }

    try {
      // Clean up backend session
      await deleteUserSession(userSession.id);
    } catch (err) {
      console.error('Logout process failed:', err);
    } finally {
      router.replace("/");
    }
  };
}