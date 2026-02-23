"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectOption } from "@/types/general";

/** Assignment type for actions beyond individual user IDs */
export enum AssignmentType {
  /** No selection made yet (placeholder state) */
  Unselected = "",
  /** Explicitly unassigned */
  None = "none",
  /** Assigned to all available assignees */
  Both = "both",
}

/** Assignee selection: either a user ID or an assignment type */
export type AssigneeSelection = Id | AssignmentType;

interface AssigneeSelectorProps {
  /** Currently selected value: empty string shows placeholder, "none" for unassigned, "both" for all, or a user ID */
  value: AssigneeSelection;
  /** Callback when selection changes */
  onValueChange: (value: AssigneeSelection) => void;
  /** Available assignee options (typically coach and coachee) */
  options: SelectOption[];
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
        <SelectItem value={AssignmentType.None}>None</SelectItem>
        {validOptions.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
        {validOptions.length >= 2 && (
          <SelectItem value={AssignmentType.Both}>Both</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};

export { AssigneeSelector };
