"use client";

import { forwardRef, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  organizationInitials,
  organizationToString,
  type Organization,
} from "@/types/organization";
import { isUserCoach } from "@/types/coaching-relationship";
import { None, Some, type Option } from "@/types/option";
import { SidebarState } from "@/types/sidebar";

const PLACEHOLDER_LABEL = "Select Organization";

function switcherLabel(organization: Organization | null): string {
  return organization
    ? `Switch organization: ${organization.name}`
    : PLACEHOLDER_LABEL;
}

/// The message to show in place of the options, when there are none to show.
function optionsMessage(
  isLoading: boolean,
  isError: boolean,
  isEmpty: boolean
): Option<string> {
  if (isLoading) return Some("Loading organizations...");
  if (isError) return Some("Error loading organizations");
  if (isEmpty) return Some("No organizations found");
  return None;
}

function OrganizationAvatar({
  name,
  logo,
  className,
}: {
  name: string | undefined;
  logo: string | undefined;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={logo} alt={name || "Organization"} />
      <AvatarFallback>{organizationInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

/// The row shared by the desktop menu items and the mobile sheet buttons.
function OrganizationOption({
  organization,
  isCurrent,
  avatarClassName,
}: {
  organization: Organization;
  isCurrent: boolean;
  avatarClassName: string;
}) {
  return (
    <>
      <OrganizationAvatar
        name={organization.name}
        logo={organization.logo}
        className={avatarClassName}
      />
      <span className={cn("truncate", isCurrent && "font-medium")}>
        {organization.name}
      </span>
      {isCurrent && <Check className="ml-auto h-4 w-4 shrink-0" />}
    </>
  );
}

const OrganizationSwitcherTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Button> & { organization: Organization | null }
>(({ organization, ...props }, ref) => (
  <Button
    ref={ref}
    variant="ghost"
    aria-label={switcherLabel(organization)}
    className="w-full justify-between px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    {...props}
  >
    <div className="flex items-center gap-2 text-left">
      <OrganizationAvatar
        name={organization?.name}
        logo={organization?.logo}
        className="h-6 w-6"
      />
      <span className="truncate">{organization?.name || PLACEHOLDER_LABEL}</span>
    </div>
    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
  </Button>
));
OrganizationSwitcherTrigger.displayName = "OrganizationSwitcherTrigger";

interface OrganizationSelectorProps {
  /// Called when an Organization is selected
  onSelect?: (organizationId: Id) => void;
}

export function OrganizationSwitcher({ onSelect }: OrganizationSelectorProps) {
  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setIsACoach = useAuthStore((state) => state.setIsACoach);
  const [open, setOpen] = useState(false);
  const sheetContentRef = useRef<HTMLDivElement>(null);

  // Use the API hook to fetch organizations
  const { organizations, isLoading, isError } = useOrganizationList(userId);

  // Use simplified organization state with SWR data
  const {
    currentOrganizationId,
    currentOrganization,
    setCurrentOrganizationId,
  } = useCurrentOrganization();
  const { state, isMobile, setOpenMobile } = useSidebar();
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
      setOpen(false);
      // Selecting navigates, and the mobile sidebar sheet would otherwise stay
      // parked over the page the user just switched to.
      if (isMobile) setOpenMobile(false);
    }
  };

  // When collapsed, just show the avatar with a tooltip
  if (isIconOnly) {
    return (
      <div className="flex justify-center py-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center">
                <OrganizationAvatar
                  name={currentOrganization?.name}
                  logo={currentOrganization?.logo}
                  className="h-7 w-7"
                />
              </div>
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
  const message = optionsMessage(isLoading, isError, options.length === 0);

  // On mobile, open into a bottom sheet the way the rest of the app does.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <OrganizationSwitcherTrigger organization={currentOrganization} />
        </SheetTrigger>
        <SheetContent
          ref={sheetContentRef}
          side="bottom"
          className="flex max-h-[85vh] flex-col gap-0 rounded-t-xl p-0"
          // Radix focuses the first focusable child on open, which would put a
          // highlight on the first organization before the user has picked.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            sheetContentRef.current?.focus();
          }}
        >
          <SheetHeader className="shrink-0 space-y-0 border-b border-border/50 px-4 py-3 text-left">
            <SheetTitle className="text-sm font-semibold">
              Switch organization
            </SheetTitle>
            <SheetDescription className="sr-only">
              Choose which organization to work in.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {message.some ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {message.val}
              </p>
            ) : (
              options.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  aria-current={currentOrganizationId === org.id}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                  onClick={() => handleSelectOrganization(org.id)}
                >
                  <OrganizationOption
                    organization={org}
                    isCurrent={currentOrganizationId === org.id}
                    avatarClassName="h-7 w-7"
                  />
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // When expanded, show the full dropdown
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
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
