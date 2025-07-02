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
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { cn } from "../lib/utils";

interface CoachingRelationshipsSelectorProps extends PopoverProps {
  className?: string;
  /// The Organization's Id for which to get a list of associated CoachingRelationships
  organizationId: Id;
  /// Disable the component from interaction with the user
  disabled: boolean;
  /// Called when a CoachingRelationship is selected
  onSelect?: (relationshipId: Id) => void;
}

function CoachingRelationshipsSelectItems({
  organizationId,
}: {
  organizationId: Id;
}) {
  const { relationships, isLoading, isError } =
    useCoachingRelationshipList(organizationId);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading coaching relationships</div>;
  if (!relationships?.length) return <div>No coaching relationships found</div>;

  return (
    <>
      {relationships.map((rel) => (
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
  ...props
}: CoachingRelationshipsSelectorProps) {
  const {
    currentCoachingRelationshipId,
    currentCoachingRelationship,
    setCurrentCoachingRelationshipId,
  } = useCurrentCoachingRelationship();
  

  const { setIsCurrentCoach } = useAuthStore((state) => state);

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
