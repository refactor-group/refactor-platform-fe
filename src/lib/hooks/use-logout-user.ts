import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
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
  const { resetCoachingRelationshipState } = useCoachingRelationshipStateStore(
    (state) => state
  );
  const clearCache = EntityApi.useClearCache();

  return async () => {
    try {
      // Clear authentication state to prevent re-initialization
      logout();

      // Execute component cleanup (TipTap providers, etc.)
      await logoutCleanupRegistry.executeAll();

      // Clear cached data
      clearCache();
      resetCoachingRelationshipState();

      // Clean up backend session
      await deleteUserSession(userSession.id);
    } catch (err) {
      console.error('Logout process failed:', err);
      // Ensure frontend state is cleared even if backend cleanup fails
      logout();
    } finally {
      router.replace("/");
    }
  };
}