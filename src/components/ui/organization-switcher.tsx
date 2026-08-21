"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  OrganizationAvatar,
  OrganizationOption,
  OrganizationSwitcherTrigger,
  PLACEHOLDER_LABEL,
  optionsMessage,
  switcherLabel,
} from "@/components/ui/organization-switcher-parts";
import { OrganizationSwitcherSheet } from "@/components/ui/organization-switcher-sheet";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrganizationList } from "@/lib/api/organizations";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import {
  useReconcileCurrentOrganization,
  type OrganizationMembership,
} from "@/lib/hooks/use-reconcile-current-organization";
import type { Id } from "@/types/general";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { organizationToString } from "@/types/organization";
import { isUserCoach } from "@/types/coaching-relationship";
import { SidebarState, StateChangeSource } from "@/types/sidebar";

interface OrganizationSelectorProps {
  /// Called when an Organization is selected
  onSelect?: (organizationId: Id) => void;
}

export function OrganizationSwitcher({ onSelect }: OrganizationSelectorProps) {
  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setIsACoach = useAuthStore((state) => state.setIsACoach);

  // Use the API hook to fetch organizations
  const { organizations, isLoading, isError } = useOrganizationList(userId);

  // Use simplified organization state with SWR data
  const {
    currentOrganizationId,
    currentOrganization,
    setCurrentOrganizationId,
  } = useCurrentOrganization();
  const { state, isMobile, setOpenMobile, expand } = useSidebar();
  // Controlled so the collapsed rail can expand the sidebar and hand the menu
  // straight to the user, across the re-render into the expanded layout.
  const [menuOpen, setMenuOpen] = useState(false);
  // On mobile the sidebar is a sheet whose contents are always full width, so
  // the icon-only treatment applies to the desktop rail alone.
  const isIconOnly = !isMobile && state === SidebarState.Collapsed;

  // Fetch coaching relationships for the current organization to determine if user is a coach
  const { relationships } = useCoachingRelationshipList(currentOrganizationId ?? "");

  // Update isACoach flag when organization or relationships change
  useEffect(() => {
    if (!userId || !relationships) {
      setIsACoach(false);
      return;
    }
    setIsACoach(isUserCoach(userId, relationships));
  }, [userId, relationships, setIsACoach]);

  // Selects a default organization when none is set, and drops a persisted
  // selection the user is no longer a member of.
  //
  // Note: the default-selection half can go away once a user has the notion of
  //       a default Organization and currentOrganizationId can start out equal
  //       to it.
  const membership = useMemo<OrganizationMembership>(
    () =>
      isLoggedIn && userId && !isLoading && !isError
        ? { kind: "loaded", organizations }
        : { kind: "unknown" },
    [isLoggedIn, userId, isLoading, isError, organizations]
  );

  useReconcileCurrentOrganization(
    membership,
    currentOrganizationId,
    setCurrentOrganizationId
  );

  // Handle organization selection
  const handleSelectOrganization = (orgId: Id) => {
    if (!organizations) return;

    const selectedOrg = organizations.find((org) => org.id === orgId);
    if (selectedOrg) {
      console.trace(
        "Setting current organization to: ",
        organizationToString(selectedOrg)
      );
      setCurrentOrganizationId(orgId);
      if (onSelect) onSelect(orgId);
      // Selecting navigates, and the mobile sidebar sheet would otherwise stay
      // parked over the page the user just switched to.
      if (isMobile) setOpenMobile(false);
    }
  };

  // When collapsed, the avatar alone stands in for the switcher: clicking it
  // expands the rail and opens the menu the user was reaching for.
  if (isIconOnly) {
    return (
      <div className="flex justify-center py-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={switcherLabel(currentOrganization)}
                onClick={() => {
                  expand(StateChangeSource.UserAction);
                  setMenuOpen(true);
                }}
                className="flex items-center justify-center rounded-full ring-offset-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <OrganizationAvatar
                  name={currentOrganization?.name}
                  logo={currentOrganization?.logo}
                  className="h-7 w-7"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {currentOrganization?.name || PLACEHOLDER_LABEL}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  const options = organizations ?? [];

  if (isMobile) {
    return (
      <OrganizationSwitcherSheet
        organizations={options}
        currentOrganization={currentOrganization}
        currentOrganizationId={currentOrganizationId}
        isLoading={isLoading}
        isError={isError}
        onSelect={handleSelectOrganization}
      />
    );
  }

  const message = optionsMessage(isLoading, isError, options.length === 0);

  // When expanded, show the full dropdown
  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <OrganizationSwitcherTrigger organization={currentOrganization} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[320px] w-[--radix-dropdown-menu-trigger-width] overflow-y-auto"
      >
        {message.some ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {message.val}
          </p>
        ) : (
          options.map((org) => (
            <DropdownMenuItem
              key={org.id}
              className="gap-2"
              onSelect={() => handleSelectOrganization(org.id)}
            >
              <OrganizationOption
                organization={org}
                isCurrent={currentOrganizationId === org.id}
                avatarClassName="h-6 w-6"
              />
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
