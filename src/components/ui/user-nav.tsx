"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

import { logoutUser } from "@/lib/api/user-session";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { userFirstLastLettersToString } from "@/types/user-session";
import { useRouter } from "next/navigation";

export function UserNav() {
  const router = useRouter();

  const { logout } = useAuthStore((action) => action);

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

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
    const err = await logoutUser();
    if (err.length > 0) {
      console.error("Error while logging out: " + err);
    }

    console.trace("Doing CoachingSessionStateStore property reset");
    resetCoachingSessionState();

    console.trace("Doing CoachingRelationshipStateStore property reset");
    resetCoachingRelationshipState();

    console.trace("Doing OrganizationStateStore property reset");
    resetOrganizationState();

    console.trace("Doing AuthStore logout");
    logout();

    router.push("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative mx-2 h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            {/* <AvatarImage src="/avatars/03.png" alt="@jhodapp" /> */}
            <AvatarFallback>
              {userFirstLastLettersToString(
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
          {/* <DropdownMenuItem>
            Current Organization
            <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            Billing
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem> */}
          <DropdownMenuItem>
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          {/* <DropdownMenuItem>New Team</DropdownMenuItem> */}
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
