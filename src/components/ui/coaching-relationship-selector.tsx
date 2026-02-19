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
import { sortRelationshipsByParticipantName } from "@/types/coaching-relationship";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useAutoSelectSingleRelationship } from "@/lib/hooks/use-auto-select-single-relationship";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { cn } from "../lib/utils";

interface CoachingRelationshipsSelectorProps extends PopoverProps {
  className?: string;
  /// The Organization's Id for which to get a list of associated CoachingRelationships
  organizationId: Id;
  /// Disable the component from interaction with the user
  disabled: boolean;
  /// Called when a CoachingRelationship is selected (required when auto-selection is enabled)
  onSelect?: (relationshipId: Id) => void;
}

function CoachingRelationshipsSelectItems({
  organizationId,
}: {
  organizationId: Id;
}) {
  const { userId } = useAuthStore((state) => state);
  const { relationships, isLoading, isError } =
    useCoachingRelationshipList(organizationId);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading coaching relationships</div>;
  if (!relationships?.length) return <div>No coaching relationships found</div>;

  const sortedRelationships = sortRelationshipsByParticipantName(relationships, userId);

  return (
    <>
      {sortedRelationships.map((rel) => (
        <SelectItem value={rel.id} key={rel.id}>
          {rel.coach_first_name} {rel.coach_last_name} -&gt;{" "}
          {rel.coachee_first_name} {rel.coachee_last_name}
        </SelectItem>
      ))}
    </>
  );
}

export default function CoachingRelationshipSelector({
  className,
  organizationId,
  disabled,
  onSelect,
  ..._props
}: CoachingRelationshipsSelectorProps) {
  const {
    currentCoachingRelationshipId,
    currentCoachingRelationship,
    setCurrentCoachingRelationshipId,
  } = useCurrentCoachingRelationship();

  const { relationships, isLoading: isLoadingRelationships } =
    useCoachingRelationshipList(organizationId);

  const { setIsCurrentCoach } = useAuthStore(
    (state) => state
  );

  const prevOrganizationIdRef = useRef<Id>(organizationId);

  const handleSetCoachingRelationship = (relationshipId: Id) => {
    setCurrentCoachingRelationshipId(relationshipId);
    if (onSelect) {
      onSelect(relationshipId);
    }
  };

  useEffect(() => {
    if (currentCoachingRelationship) {
      setIsCurrentCoach(currentCoachingRelationship.coach_id);
    }
  }, [currentCoachingRelationship, setIsCurrentCoach]);

  useEffect(() => {
    if (organizationId && prevOrganizationIdRef.current && organizationId !== prevOrganizationIdRef.current) {
      setCurrentCoachingRelationshipId("");
    }
    prevOrganizationIdRef.current = organizationId;
  }, [organizationId, setCurrentCoachingRelationshipId]);

  // Auto-select relationship when user has exactly one and none is currently selected
  useAutoSelectSingleRelationship(
    relationships,
    isLoadingRelationships,
    currentCoachingRelationshipId,
    setCurrentCoachingRelationshipId,
    onSelect
  );

  const displayValue =
    currentCoachingRelationship && currentCoachingRelationship.id ? (
      <>
        {currentCoachingRelationship.coach_first_name}{" "}
        {currentCoachingRelationship.coach_last_name} -&gt;{" "}
        {currentCoachingRelationship.coachee_first_name}{" "}
        {currentCoachingRelationship.coachee_last_name}
      </>
    ) : undefined;

  return (
    <div className={cn("font-normal", className)}>
      <Select
        disabled={disabled}
        value={currentCoachingRelationshipId ?? undefined}
        onValueChange={handleSetCoachingRelationship}
      >
        <SelectTrigger id="coaching-relationship-selector">
          <SelectValue placeholder="Select coaching relationship">
            {displayValue}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <CoachingRelationshipsSelectItems organizationId={organizationId} />
        </SelectContent>
      </Select>
    </div>
  );
}
