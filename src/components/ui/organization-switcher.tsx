"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrganizationList } from "@/lib/api/organizations";
import type { PopoverProps } from "@radix-ui/react-popover";
import type { Id } from "@/types/general";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { organizationToString } from "@/types/organization";

const LOGO = "/placeholder.svg?height=40&width=40";
const SHORT_NAME = "RC";

interface OrganizationSelectorProps extends PopoverProps {
  /// Called when an Organization is selected
  onSelect?: (organizationId: Id) => void;
}

export function OrganizationSwitcher({
  onSelect,
  ...props
}: OrganizationSelectorProps) {
  const { userId } = useAuthStore((state) => state);
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Use the API hook to fetch organizations
  const { organizations, isLoading, isError } = useOrganizationList(userId);

  const { currentOrganization, setCurrentOrganization } =
    useOrganizationStateStore((state) => state);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Initialize with first organization if none is selected
  React.useEffect(() => {
    if (!currentOrganization?.id && organizations && organizations.length > 0) {
      console.trace(
        "Initializing current organization to: ",
        organizationToString(organizations[0])
      );
      setCurrentOrganization(organizations[0]);
    }
  }, [organizations, currentOrganization, setCurrentOrganization]);

  // Filter organizations based on search query
  const filteredOrganizations = React.useMemo(() => {
    if (!organizations) return [];
    if (!searchQuery) return organizations;

    return organizations.filter((org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [organizations, searchQuery]);

  // Reset focused index when filtered organizations change
  React.useEffect(() => {
    setFocusedIndex(0);
  }, [filteredOrganizations]);

  // Focus search input when popover opens
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  // Clear search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!filteredOrganizations.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < filteredOrganizations.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOrganizations[focusedIndex]) {
          handleSelectOrganization(filteredOrganizations[focusedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Scroll focused item into view
  React.useEffect(() => {
    if (listRef.current && filteredOrganizations.length > 0) {
      const focusedElement = listRef.current.children[
        focusedIndex
      ] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex, filteredOrganizations.length]);

  // When collapsed, just show the avatar with a tooltip
  if (isCollapsed) {
    return (
      <div className="flex justify-center py-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center">
                <Avatar className="h-7 w-7">
                  <AvatarImage
                    src={currentOrganization?.logo || LOGO}
                    alt={currentOrganization?.name || "Organization"}
                  />
                  <AvatarFallback>{SHORT_NAME}</AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {currentOrganization?.name || "Select Organization"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // Handle organization selection
  const handleSelectOrganization = (orgId: Id) => {
    if (!organizations) return;

    const selectedOrg = organizations.find((org) => org.id === orgId);
    if (selectedOrg) {
      console.trace(
        "Setting current organization to: ",
        organizationToString(selectedOrg)
      );
      setCurrentOrganization(selectedOrg);
      if (onSelect) onSelect(orgId);
      setOpen(false);
    }
  };

  // When expanded, show the full dropdown
  return (
    <Popover
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          setSearchQuery("");
        }
      }}
      {...props}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <div className="flex items-center gap-2 text-left">
            <Avatar className="h-6 w-6">
              <AvatarImage
                src={currentOrganization?.logo || LOGO}
                alt={currentOrganization?.name || "Organization"}
              />
              <AvatarFallback>{SHORT_NAME}</AvatarFallback>
            </Avatar>
            <span className="truncate">
              {currentOrganization?.name || "Select Organization"}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: triggerRef.current?.offsetWidth }}
      >
        <div className="relative">
          <input
            ref={searchInputRef}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Search organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div
            ref={listRef}
            className="max-h-[300px] overflow-auto p-1"
            role="listbox"
            tabIndex={-1}
          >
            {isLoading ? (
              <div className="py-6 text-center text-sm">
                Loading organizations...
              </div>
            ) : isError ? (
              <div className="py-6 text-center text-sm">
                Error loading organizations
              </div>
            ) : !filteredOrganizations || filteredOrganizations.length === 0 ? (
              <div className="py-6 text-center text-sm">
                No organizations found
              </div>
            ) : (
              <div>
                {filteredOrganizations.map((org, index) => (
                  <button
                    key={org.id}
                    role="option"
                    aria-selected={focusedIndex === index}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                      focusedIndex === index &&
                        "bg-accent text-accent-foreground",
                      currentOrganization?.id === org.id
                        ? "font-medium"
                        : "font-normal",
                      "hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => handleSelectOrganization(org.id)}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={org.logo} alt={org.name} />
                        <AvatarFallback>{SHORT_NAME}</AvatarFallback>
                      </Avatar>
                      <span>{org.name}</span>
                      {currentOrganization?.id === org.id && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
