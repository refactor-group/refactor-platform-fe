"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  stringToActionStatus,
} from "@/types/general";
import { useActionList } from "@/lib/api/actions";
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

const ActionsList: React.FC<{
  coachingSessionId: Id;
  userId: Id;
  locale: string | "us";
  onActionAdded: (
    body: string,
    status: ItemStatus,
    dueBy: DateTime
  ) => Promise<Action>;
  onActionEdited: (
    id: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime
  ) => Promise<Action>;
  onActionDeleted: (id: Id) => Promise<Action>;
}> = ({
  coachingSessionId,
  onActionAdded: onActionAdded,
  onActionEdited: onActionEdited,
  onActionDeleted: onActionDeleted,
}) => {
  enum ActionSortField {
    Body = "body",
    DueBy = "due_by",
    Status = "status",
    Assigned = "created_at",
  }

  const { actions, refresh } = useActionList(coachingSessionId);
  const [newBody, setNewBody] = useState("");
  const [newStatus, setNewStatus] = useState<ItemStatus>(ItemStatus.NotStarted);
  const [newDueBy, setNewDueBy] = useState<DateTime>(DateTime.now());
  const [editingActionId, setEditingActionId] = useState<Id | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof Action>(
    ActionSortField.DueBy
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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
    setNewStatus(ItemStatus.NotStarted);
    setNewDueBy(DateTime.now());
  };

  // Function to cancel editing an action
  const cancelEditAction = () => {
    setEditingActionId(null);
    clearNewActionForm();
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

      await onActionEdited(
        actionId,
        action.body || "",
        newStatus,
        action.due_by
      );
      refresh();
    } catch (err) {
      console.error("Failed to update action completion status: " + err);
    }
  };

  const addAction = async () => {
    if (newBody.trim() === "") return;

    try {
      if (editingActionId) {
        // Update existing action
        const action = await onActionEdited(
          editingActionId,
          newBody,
          newStatus,
          newDueBy
        );
        console.trace("Updated Action: " + actionToString(action));
        setEditingActionId(null);
      } else {
        // Create new action
        const action = await onActionAdded(newBody, newStatus, newDueBy);
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
                    "w-[120px]",
                    getTableHeaderCellClassesNonSortable(true)
                  )}
                >
                  Completed?
                </TableHead>
                <TableHead
                  onClick={() => sortActions(ActionSortField.Body)}
                  className={getTableHeaderCellClasses()}
                >
                  Action {renderSortArrow(ActionSortField.Body)}
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
                  onClick={() => sortActions(ActionSortField.Assigned)}
                  className={cn(
                    getTableHeaderCellClasses(),
                    "hidden md:table-cell"
                  )}
                >
                  Assigned {renderSortArrow(ActionSortField.Assigned)}
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
              {sortedActions.map((action, index) => (
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
                    {actionStatusToString(action.status)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {action.due_by
                      .setLocale(siteConfig.locale)
                      .toLocaleString(DateTime.DATE_MED)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {action.created_at
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
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingActionId(action.id);
                            setNewBody(action.body ?? "");
                            setNewStatus(action.status);
                            setNewDueBy(action.due_by);
                          }}
                        >
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
              ))}
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
          <Select
            value={newStatus}
            onValueChange={(value) => setNewStatus(stringToActionStatus(value))}
          >
            <SelectTrigger className="w-full sm:w-60">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ItemStatus).map((status) => (
                <SelectItem value={status} key={status}>
                  {actionStatusToString(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[280px] justify-start text-left font-normal",
                  !newDueBy && "text-muted-foreground"
                )}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                {newDueBy ? (
                  format(newDueBy.toJSDate(), "PPP")
                ) : (
                  <span>Pick a due date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={newDueBy.toJSDate()}
                onSelect={(date: Date | undefined) =>
                  setNewDueBy(date ? DateTime.fromJSDate(date) : DateTime.now())
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
