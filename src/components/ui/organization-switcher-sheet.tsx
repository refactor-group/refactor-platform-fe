"use client";

import { useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  OrganizationOption,
  OrganizationSwitcherTrigger,
  optionsMessage,
} from "@/components/ui/organization-switcher-parts";
import type { Id } from "@/types/general";
import type { Organization } from "@/types/organization";
import type { Option } from "@/types/option";

interface OrganizationSwitcherSheetProps {
  organizations: Organization[];
  currentOrganization: Option<Organization>;
  currentOrganizationId: Id;
  isLoading: boolean;
  isError: boolean;
  /// Called when an Organization is selected
  onSelect: (organizationId: Id) => void;
}

export function OrganizationSwitcherSheet({
  organizations,
  currentOrganization,
  currentOrganizationId,
  isLoading,
  isError,
  onSelect,
}: OrganizationSwitcherSheetProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const message = optionsMessage(isLoading, isError, organizations.length === 0);

  const handleSelect = (organizationId: Id) => {
    setOpen(false);
    onSelect(organizationId);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <OrganizationSwitcherTrigger organization={currentOrganization} />
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        tabIndex={-1}
        side="bottom"
        className="flex max-h-[85vh] flex-col gap-0 rounded-t-xl p-0"
        // Radix would otherwise focus the first organization, pre-highlighting
        // a choice the user has not made.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
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
            organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                aria-current={currentOrganizationId === org.id}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                onClick={() => handleSelect(org.id)}
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
