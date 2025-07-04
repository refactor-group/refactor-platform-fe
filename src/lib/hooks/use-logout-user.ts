import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
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
  const { resetCoachingRelationshipState } = useCoachingRelationshipStateStore(
    (action) => action
  );

  return async () => {
    try {
      // Reset auth store FIRST to prevent other components from re-initializing
      console.trace("Resetting AuthStore state");
      logout();

      console.trace("Resetting CoachingRelationshipStateStore state");
      resetCoachingRelationshipState();

      console.trace("Resetting OrganizationStateStore state");
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