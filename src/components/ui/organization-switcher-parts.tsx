"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { organizationInitials, type Organization } from "@/types/organization";
import { None, Some, type Option } from "@/types/option";

/// Presentation shared by the desktop menu and the mobile sheet, so the two
/// switchers can't drift apart.

export const PLACEHOLDER_LABEL = "Select Organization";

export function switcherLabel(organization: Organization | null): string {
  return organization
    ? `Switch organization: ${organization.name}`
    : PLACEHOLDER_LABEL;
}

/// The message to show in place of the options, when there are none to show.
export function optionsMessage(
  isLoading: boolean,
  isError: boolean,
  isEmpty: boolean
): Option<string> {
  if (isLoading) return Some("Loading organizations...");
  if (isError) return Some("Error loading organizations");
  if (isEmpty) return Some("No organizations found");
  return None;
}

export function OrganizationAvatar({
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
export function OrganizationOption({
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

export const OrganizationSwitcherTrigger = forwardRef<
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
