import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
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
  const { resetOrganizationState } = useOrganizationStateStore(
    (action) => action
  );
  const { resetCoachingRelationshipState, currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );
  const clearCache = EntityApi.useClearCache();

  return async () => {
    console.warn('🚪 [USE-LOGOUT-USER] Starting logout sequence');
    console.warn('🚪 [USE-LOGOUT-USER] Current userSession:', userSession?.id);
    try {
      // Reset auth store FIRST to prevent other components from re-initializing
      console.trace("🚪 [USE-LOGOUT-USER] Calling logout() to reset AuthStore state");
      logout();
      console.trace("🚪 [USE-LOGOUT-USER] logout() completed - isLoggedIn should now be false");

      // Execute registered cleanup functions (e.g., TipTap provider cleanup)
      console.trace("🚪 [USE-LOGOUT-USER] Executing component cleanup functions");
      await logoutCleanupRegistry.executeAll();
      console.trace("🚪 [USE-LOGOUT-USER] Component cleanup completed");

      console.trace("🚪 LOGOUT: Clearing SWR cache");
      clearCache();

      console.trace("🚪 LOGOUT: Resetting CoachingRelationshipStateStore state - BEFORE:", {
        currentCoachingRelationshipId
      });
      resetCoachingRelationshipState();
      console.trace("🚪 LOGOUT: Resetting CoachingRelationshipStateStore state - AFTER (will check in next render)");

      console.trace("🚪 LOGOUT: Resetting OrganizationStateStore state");
      resetOrganizationState();

      console.trace(
        "Deleting current user session from backend: ",
        userSession.id
      );
      await deleteUserSession(userSession.id);
    } catch (err) {
      console.warn("Error while logging out session: ", userSession.id, err);
      // If backend delete fails, still ensure frontend logout happened
      logout();
    } finally {
      console.debug("Navigating to /");
      router.replace("/");
    }
  };
}