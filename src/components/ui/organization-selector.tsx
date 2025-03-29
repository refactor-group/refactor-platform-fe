"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "@/types/general";
import { useOrganizationList } from "@/lib/api/organizations";
import { useEffect } from "react";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";

interface OrganizationSelectorProps extends PopoverProps {
  /// The User's Id for which to get a list of associated Organizations
  userId: Id;
  /// Called when an Organization is selected
  onSelect?: (organizationId: Id) => void;
}

function OrganizationsList({ userId }: { userId: Id }) {
  const { organizations, isLoading, isError } = useOrganizationList(userId);
  const { setCurrentOrganizations } = useOrganizationStateStore(
    (state) => state
  );

  // Be sure to cache the list of current organizations in the OrganizationStateStore
  useEffect(() => {
    if (!organizations?.length) return;
    console.debug(
      `organizations (useEffect): ${JSON.stringify(organizations)}`
    );
    setCurrentOrganizations(organizations);
  }, [organizations, setCurrentOrganizations]);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading organizations</div>;
  if (!organizations?.length) return <div>No organizations found</div>;

  return (
    <>
      {organizations.map((org) => (
        <SelectItem value={org.id} key={org.id}>
          {org.name}
        </SelectItem>
      ))}
    </>
  );
}

export default function OrganizationSelector({
  userId,
  onSelect,
  ...props
}: OrganizationSelectorProps) {
  const {
    currentOrganizationId,
    setCurrentOrganization,
    getCurrentOrganization,
  } = useOrganizationStateStore((state) => state);
  const { resetCoachingSessionState } = useCoachingSessionStateStore(
    (state) => state
  );
  const { resetCoachingRelationshipState } = useCoachingRelationshipStateStore(
    (state) => state
  );

  const handleSetOrganization = (organizationId: Id) => {
    const organization = getCurrentOrganization(organizationId);
    setCurrentOrganization(organization);
    console.info("Resetting Coaching Session State");
    resetCoachingRelationshipState();
    resetCoachingSessionState();
    if (onSelect) {
      onSelect(organizationId);
    }
  };

  return (
    <Select value={currentOrganizationId} onValueChange={handleSetOrganization}>
      <SelectTrigger id="organization-selector">
        <SelectValue placeholder="Select organization">
          {getCurrentOrganization(currentOrganizationId).name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <OrganizationsList userId={userId} />
      </SelectContent>
    </Select>
  );
}
