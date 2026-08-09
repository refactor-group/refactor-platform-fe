import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionsCardFilterStore } from "@/lib/providers/coaching-sessions-card-filter-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { EntityApi } from "@/lib/api/entity-api";
import { useRouter } from "next/navigation";
import { logoutCleanupRegistry } from "./logout-cleanup-registry";

export function useLogoutUser() {
  const router = useRouter();
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
    try {
      // Clear authentication state to prevent re-initialization
      logout();

      // Execute component cleanup (TipTap providers, etc.)
      await logoutCleanupRegistry.executeAll();

      // Clean up backend session
      await deleteUserSession(userSession.id);
    } catch (err) {
      console.error('Logout process failed:', err);
      // Ensure frontend state is cleared even if backend cleanup fails
      logout();
    } finally {
      // Local teardown is not conditional on anything above it, and no step
      // may strand the ones after it. The organization selection is the one
      // that matters most: it is persisted to localStorage, so failing to
      // clear it hands the next user on this browser the previous user's
      // organization. Ordered cheapest-and-most-important first, with the
      // cache walk — the step most able to throw — last.
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

      router.replace("/");
    }
  };
}