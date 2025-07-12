import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { EntityApi } from "@/lib/api/entity-api";
import { useRouter } from "next/navigation";

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
    try {
      // Reset auth store FIRST to prevent other components from re-initializing
      console.trace("🚪 LOGOUT: Resetting AuthStore state");
      logout();

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
      await router.replace("/");
    }
  };
}