"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "@/types/general";

/** Represents a user who can be assigned to an action */
export interface AssigneeOption {
  id: Id;
  name: string;
}

/** Constants for special assignee selection values */
export const ASSIGNEE_UNSELECTED = "" as const;
export const ASSIGNEE_NONE = "none" as const;
export const ASSIGNEE_BOTH = "both" as const;

/** Special selection values beyond individual user IDs */
export type AssigneeSelection = Id | typeof ASSIGNEE_UNSELECTED | typeof ASSIGNEE_NONE | typeof ASSIGNEE_BOTH;

interface AssigneeSelectorProps {
  /** Currently selected value: empty string shows placeholder, "none" for unassigned, "both" for all, or a user ID */
  value: AssigneeSelection;
  /** Callback when selection changes */
  onValueChange: (value: AssigneeSelection) => void;
  /** Available assignee options (typically coach and coachee) */
  options: AssigneeOption[];
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Additional CSS classes for the trigger */
  className?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * A reusable dropdown selector for choosing an assignee.
 *
 * Displays a "None" option, individual assignee options, and a "Both" option
 * when multiple assignees are available. Designed for use in coaching contexts
 * where actions can be assigned to the coach, coachee, both, or left unassigned.
 */
const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "Assignee",
  className = "w-full sm:w-40",
  disabled = false,
}) => {
  // Filter out invalid options (empty IDs)
  const validOptions = options.filter(
    (option) => option.id && option.id.trim() !== ""
  );

  return (
    <Select
      value={value}
      onValueChange={(val) => onValueChange(val as AssigneeSelection)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ASSIGNEE_NONE}>None</SelectItem>
        {validOptions.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
        {validOptions.length >= 2 && (
          <SelectItem value={ASSIGNEE_BOTH}>Both</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};

export { AssigneeSelector };
