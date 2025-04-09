"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useUserSessionMutation } from "@/lib/api/user-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { userSessionFirstLastLettersToString } from "@/types/user-session";
import { useRouter } from "next/navigation";

export function UserNav() {
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

  async function logout_user() {
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
      await router.push("/");
      console.debug("Navigation to / completed successfully.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative mx-2 h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {userSessionFirstLastLettersToString(
                userSession.first_name,
                userSession.last_name
              )}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{`${userSession.first_name} ${userSession.last_name}`}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userSession.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout_user}>
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
