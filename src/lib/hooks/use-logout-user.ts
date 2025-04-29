import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
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
  const { resetCoachingSessionState } = useCoachingSessionStateStore(
    (action) => action
  );

  return async () => {
    try {
      console.trace("Resetting CoachingSessionStateStore state");
      resetCoachingSessionState();

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