"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  AssigneeSelector,
  AssigneeOption,
  AssigneeSelection,
  AssignmentType,
} from "@/components/ui/assignee-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  CalendarClock,
} from "lucide-react";
import {
  ItemStatus,
  actionStatusToString,
  Id,
} from "@/types/general";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserActionsList } from "@/lib/api/user-actions";
import { UserActionsScope, type RelationshipContext } from "@/types/assigned-actions";
import { resolveUserNameInRelationship } from "@/lib/relationships/relationship-utils";
import { DateTime } from "ts-luxon";
import { siteConfig } from "@/site.config";
import { Action, actionToString } from "@/types/action";
import { cn } from "@/components/lib/utils";
import {
  getTableRowClasses,
  getCompletedItemClasses,
  getTableHeaderRowClasses,
  getTableHeaderCellClasses,
  getTableHeaderCellClassesNonSortable,
} from "@/components/lib/utils/table-styling";
import { format } from "date-fns";

interface ActionsListProps {
  coachingSessionId: Id;
  userId: Id;
  locale: string | "us";
  /** Coach user ID for resolving assignee names */
  coachId: Id;
  /** Coach display name (first name or display name) */
  coachName: string;
  /** Coachee user ID for resolving assignee names */
  coacheeId: Id;
  /** Coachee display name (first name or display name) */
  coacheeName: string;
  onActionAdded: (
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  onActionEdited: (
    id: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  onActionDeleted: (id: Id) => Promise<Action>;
}

const ActionsList: React.FC<ActionsListProps> = ({
  coachingSessionId,
  userId,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onActionAdded,
  onActionEdited,
  onActionDeleted,
}) => {
  enum ActionSortField {
    Body = "body",
    DueBy = "due_by",
    Status = "status",
  }

  // Build relationship context for resolving assignee names
  const relationshipContext: RelationshipContext = useMemo(
    () => ({
      coachingRelationshipId: "",
      coachId,
      coacheeId,
      coachName,
      coacheeName,
    }),
    [coachId, coacheeId, coachName, coacheeName]
  );

  const { actions, refresh } = useUserActionsList(userId, {
    scope: UserActionsScope.Sessions,
    coaching_session_id: coachingSessionId,
  });
  const [newBody, setNewBody] = useState("");
  const [newDueBy, setNewDueBy] = useState<DateTime | null>(null);
  const [newAssigneeId, setNewAssigneeId] = useState<AssigneeSelection>(AssignmentType.Unselected);
  const [newStatus, setNewStatus] = useState<ItemStatus | null>(null);
  const [editingActionId, setEditingActionId] = useState<Id | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof Action>(
    ActionSortField.DueBy
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Memoized assignee options for the selector dropdown
  const assigneeOptions: AssigneeOption[] = useMemo(
    () => [
      { id: coachId, name: coachName },
      { id: coacheeId, name: coacheeName },
    ],
    [coachId, coachName, coacheeId, coacheeName]
  );

  // Function to render the appropriate sort arrow
  const renderSortArrow = (column: keyof Action) => {
    if (sortColumn !== column) return null;

    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  };

  // Function to clear the new action form
  const clearNewActionForm = () => {
    setNewBody("");
    setNewDueBy(null);
    setNewAssigneeId(AssignmentType.Unselected);
    setNewStatus(null);
  };

  // Function to cancel editing an action
  const cancelEditAction = () => {
    setEditingActionId(null);
    clearNewActionForm();
  };

  // Function to populate the form with an existing action for editing
  const startEditingAction = (action: Action) => {
    setEditingActionId(action.id);
    setNewBody(action.body ?? "");

    // Determine assignee selection from existing IDs
    const ids = action.assignee_ids ?? [];
    let selection: AssigneeSelection = AssignmentType.None;
    if (ids.length >= 2) {
      // If both coach and coachee are assigned, select "both"
      selection = AssignmentType.Both;
    } else if (ids.length === 1) {
      selection = ids[0];
    }
    setNewAssigneeId(selection);
    setNewDueBy(action.due_by);
    setNewStatus(action.status);
  };

  // Function to handle checkbox toggle for completion
  const handleCompletionToggle = async (
    actionId: Id,
    currentStatus: ItemStatus
  ) => {
    try {
      const action = actions.find((a) => a.id === actionId);
      if (!action) return;

      const newStatus =
        currentStatus === ItemStatus.Completed
          ? ItemStatus.InProgress
          : ItemStatus.Completed;

      // Preserve existing assignees when toggling completion
      await onActionEdited(
        actionId,
        action.body || "",
        newStatus,
        action.due_by,
        action.assignee_ids
      );
      refresh();
    } catch (err) {
      console.error("Failed to update action completion status: " + err);
    }
  };

  /** Converts the assignee selection to an array of user IDs */
  const selectionToAssigneeIds = (selection: AssigneeSelection): Id[] => {
    if (selection === AssignmentType.Unselected || selection === AssignmentType.None) return [];
    if (selection === AssignmentType.Both) return [coachId, coacheeId].filter((id) => id);
    return [selection];
  };

  const addAction = async () => {
    if (newBody.trim() === "") return;

    // Convert assignee selection to array of IDs
    const assigneeIds = selectionToAssigneeIds(newAssigneeId);

    // Use selected due date or default to now
    const dueBy = newDueBy ?? DateTime.now();

    try {
      if (editingActionId) {
        // Update existing action with selected status
        const statusToUse = newStatus ?? ItemStatus.NotStarted;

        const action = await onActionEdited(
          editingActionId,
          newBody,
          statusToUse,
          dueBy,
          assigneeIds
        );
        console.trace("Updated Action: " + actionToString(action));
        setEditingActionId(null);
      } else {
        // Create new action with default status
        const action = await onActionAdded(
          newBody,
          ItemStatus.NotStarted,
          dueBy,
          assigneeIds
        );
        console.trace("Newly created Action: " + actionToString(action));
      }

      // Refresh the actions list from the hook
      refresh();

      // Clear input fields
      clearNewActionForm();
    } catch (err) {
      console.error("Failed to save Action: " + err);
      throw err;
    }
  };

  const deleteAction = async (id: Id) => {
    if (id === "") return;

    try {
      // Delete action in backend
      const deletedAction = await onActionDeleted(id);

      console.trace(
        "Deleted Action (onActionDeleted): " + actionToString(deletedAction)
      );

      // Refresh the actions list from the hook
      refresh();
    } catch (err) {
      console.error("Failed to delete Action (id: " + id + "): " + err);
      throw err;
    }
  };

  const sortActions = (column: keyof Action) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedActions = [...actions].sort((a, b) => {
    const aValue = a[sortColumn as keyof Action]!;
    const bValue = b[sortColumn as keyof Action]!;

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div>
      <div className="bg-inherit rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <Table>
            <TableHeader>
              <TableRow className={getTableHeaderRowClasses()}>
                <TableHead
                  className={cn(
                    "w-[80px]",
                    getTableHeaderCellClassesNonSortable(true)
                  )}
                >
                  Done?
                </TableHead>
                <TableHead
                  onClick={() => sortActions(ActionSortField.Body)}
                  className={getTableHeaderCellClasses()}
                >
                  Action {renderSortArrow(ActionSortField.Body)}
                </TableHead>
                <TableHead
                  className={cn(
                    getTableHeaderCellClassesNonSortable(false),
                    "hidden sm:table-cell"
                  )}
                >
                  Assignee
                </TableHead>
                <TableHead
                  onClick={() => sortActions(ActionSortField.Status)}
                  className={cn(
                    getTableHeaderCellClasses(),
                    "hidden sm:table-cell"
                  )}
                >
                  Status {renderSortArrow(ActionSortField.Status)}
                </TableHead>
                <TableHead
                  onClick={() => sortActions(ActionSortField.DueBy)}
                  className={cn(
                    getTableHeaderCellClasses(),
                    "hidden md:table-cell"
                  )}
                >
                  Due By {renderSortArrow(ActionSortField.DueBy)}
                </TableHead>
                <TableHead
                  className={cn(
                    "w-[100px]",
                    getTableHeaderRowClasses(),
                    getTableHeaderCellClassesNonSortable(false, true)
                  )}
                ></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedActions.length === 0 ? (
                <TableRow className={getTableRowClasses(0)}>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No Actions
                  </TableCell>
                </TableRow>
              ) : (
                sortedActions.map((action, index) => (
                <TableRow
                  key={action.id}
                  aria-label={
                    action.status === ItemStatus.Completed
                      ? "Completed action"
                      : undefined
                  }
                  className={getTableRowClasses(
                    index,
                    action.status === ItemStatus.Completed
                      ? getCompletedItemClasses()
                      : undefined
                  )}
                >
                  <TableCell className="text-left">
                    <Checkbox
                      checked={action.status === ItemStatus.Completed}
                      onCheckedChange={() =>
                        handleCompletionToggle(action.id, action.status)
                      }
                    />
                  </TableCell>
                  <TableCell>{action.body}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1 justify-start">
                      {action.assignee_ids && action.assignee_ids.length > 0 ? (
                        action.assignee_ids.map((assigneeId) => {
                          const isUnknown = assigneeId !== coachId && assigneeId !== coacheeId;
                          return (
                            <Badge
                              key={assigneeId}
                              variant={isUnknown ? "destructive" : "secondary"}
                              title={isUnknown ? `Unknown user ID: ${assigneeId}` : undefined}
                              className="text-sm font-normal"
                            >
                              {resolveUserNameInRelationship(assigneeId, relationshipContext)}
                            </Badge>
                          );
                        })
                      ) : (
                        <Badge variant="outline" className="text-sm font-normal text-muted-foreground">
                          None
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {actionStatusToString(action.status)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {action.due_by
                      .setLocale(siteConfig.locale)
                      .toLocaleString(DateTime.DATE_MED)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEditingAction(action)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteAction(action.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* Create/Edit action form */}
        <div
          className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              editingActionId ? cancelEditAction() : clearNewActionForm();
            } else if (e.key === "Enter") {
              addAction();
            }
          }}
          tabIndex={-1}
        >
          <Input
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder={editingActionId ? "Edit action" : "Enter new action"}
            className="w-full sm:flex-grow"
          />
          <AssigneeSelector
            value={newAssigneeId}
            onValueChange={setNewAssigneeId}
            options={assigneeOptions}
            className="w-full sm:w-40"
          />
          {editingActionId && (
            <Select
              value={newStatus ?? undefined}
              onValueChange={(value) => setNewStatus(value as ItemStatus)}
            >
              <SelectTrigger className="w-full sm:w-36 sm:shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ItemStatus.NotStarted}>Not Started</SelectItem>
                <SelectItem value={ItemStatus.InProgress}>In Progress</SelectItem>
                <SelectItem value={ItemStatus.Completed}>Completed</SelectItem>
                <SelectItem value={ItemStatus.WontDo}>Won&apos;t Do</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full sm:min-w-[180px] sm:max-w-[220px] justify-start text-left font-normal",
                  !newDueBy && "text-muted-foreground"
                )}
              >
                <CalendarClock className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {newDueBy ? format(newDueBy.toJSDate(), "PPP") : "Due By"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={newDueBy?.toJSDate()}
                onSelect={(date: Date | undefined) =>
                  setNewDueBy(date ? DateTime.fromJSDate(date) : null)
                }
                footer=<div className="text-sm font-medium mt-1">
                  {newDueBy
                    ? `Due by: ${newDueBy.toLocaleString()}`
                    : "Select a due by date."}
                </div>
              />
            </PopoverContent>
          </Popover>
          <Button onClick={addAction} className="w-full sm:w-auto">
            {editingActionId ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export { ActionsList };
