import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useSimpleOrganizationStateStore } from "@/lib/providers/simple-organization-state-store-provider";
import { useSimpleCoachingRelationshipStateStore } from "@/lib/providers/simple-coaching-relationship-state-store-provider";
import { useRouter } from "next/navigation";

export function useLogoutUser() {
  const router = useRouter();
  const { logout } = useAuthStore((action) => action);
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const { delete: deleteUserSession } = useUserSessionMutation();
  const { resetOrganizationState } = useSimpleOrganizationStateStore(
    (action) => action
  );
  const { resetCoachingRelationshipState } = useSimpleCoachingRelationshipStateStore(
    (action) => action
  );

  return async () => {
    try {
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
    } finally {
      // Ensure we still log out of the frontend even if the backend request
      // to delete the user session fails.
      console.trace("Resetting AuthStore state");
      logout();
      
      console.debug("Navigating to /");
      await router.replace("/");
    }
  };
}