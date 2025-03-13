"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { MoreHorizontal, ArrowUpDown, CalendarClock } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
    CreatedAt = "created_at",
    UpdatedAt = "updated_at",
  }

  const { actions, isLoading, isError, refresh } =
    useActionList(coachingSessionId);
  const [newBody, setNewBody] = useState("");
  const [newStatus, setNewStatus] = useState<ItemStatus>(ItemStatus.NotStarted);
  const [newDueBy, setNewDueBy] = useState<DateTime>(DateTime.now());
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>(
    ItemStatus.NotStarted
  );
  const [editDueBy, setEditDueBy] = useState<DateTime>(DateTime.now());
  const [sortColumn, setSortColumn] = useState<keyof Action>(
    ActionSortField.CreatedAt
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const addAction = async () => {
    if (newBody.trim() === "") return;

    try {
      // Call the external handler to create the action
      const action = await onActionAdded(newBody, newStatus, newDueBy);

      console.trace(
        "Newly created Action (onActionAdded): " + actionToString(action)
      );

      // Refresh the actions list from the hook
      refresh();

      // Clear input fields
      setNewBody("");
      setNewStatus(ItemStatus.NotStarted);
      setNewDueBy(DateTime.now());
    } catch (err) {
      console.error("Failed to create new Action: " + err);
      throw err;
    }
  };

  const updateAction = async (
    id: Id,
    newBody: string,
    newStatus: ItemStatus,
    newDueBy: DateTime
  ) => {
    const body = newBody.trim();
    if (body === "") return;

    try {
      // Call the external onActionEdited handler function which should
      // update the stored version of this action in the backend database
      const updatedAction = await onActionEdited(id, body, newStatus, newDueBy);

      console.trace(
        "Updated Action (onActionUpdated): " + actionToString(updatedAction)
      );

      // Refresh the actions list from the hook
      refresh();

      // Reset editing UI state
      setEditingId(null);
      setEditBody("");
      setEditStatus(ItemStatus.NotStarted);
      setEditDueBy(DateTime.now());
    } catch (err) {
      console.error("Failed to update Action (id: " + id + "): ", err);
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
              <TableRow>
                <TableHead
                  onClick={() => sortActions(ActionSortField.Body)}
                  className={`cursor-pointer ${
                    sortColumn === ActionSortField.Body
                      ? "underline"
                      : "no-underline"
                  }`}
                >
                  Action <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead
                  onClick={() => sortActions(ActionSortField.Status)}
                  className={`cursor-pointer hidden sm:table-cell ${
                    sortColumn === ActionSortField.Status
                      ? "underline"
                      : "no-underline"
                  }`}
                >
                  Status <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead
                  onClick={() => sortActions(ActionSortField.DueBy)}
                  className={`cursor-pointer hidden md:table-cell ${
                    sortColumn === ActionSortField.DueBy
                      ? "underline"
                      : "no-underline"
                  }`}
                >
                  Due By
                  <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead
                  onClick={() => sortActions(ActionSortField.CreatedAt)}
                  className={`cursor-pointer hidden md:table-cell ${
                    sortColumn === ActionSortField.CreatedAt
                      ? "underline"
                      : "no-underline"
                  }`}
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead
                  className={`cursor-pointer hidden md:table-cell ${
                    sortColumn === ActionSortField.UpdatedAt
                      ? "underline"
                      : "no-underline"
                  }`}
                  onClick={() => sortActions(ActionSortField.UpdatedAt)}
                >
                  Updated <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedActions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell>
                    {/* Edit an existing action */}
                    {editingId === action.id ? (
                      <div className="flex items-center space-x-2">
                        <Input
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" &&
                            updateAction(
                              action.id,
                              editBody,
                              editStatus,
                              editDueBy
                            )
                          }
                          className="flex-grow"
                        />
                        <Select
                          value={editStatus}
                          onValueChange={(newStatus) =>
                            setEditStatus(stringToActionStatus(newStatus))
                          }
                        >
                          <SelectTrigger className="w-auto">
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(ItemStatus).map((s) => (
                              <SelectItem value={s} key={s}>
                                {actionStatusToString(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[280px] justify-start text-left font-normal",
                                !editDueBy && "text-muted-foreground"
                              )}
                            >
                              <CalendarClock className="mr-2 h-4 w-4" />
                              {editDueBy ? (
                                format(editDueBy.toJSDate(), "PPP")
                              ) : (
                                <span>Pick a due date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              defaultMonth={action.due_by.toJSDate()}
                              selected={editDueBy.toJSDate()}
                              onSelect={(date: Date | undefined) =>
                                setEditDueBy(
                                  date
                                    ? DateTime.fromJSDate(date)
                                    : DateTime.now()
                                )
                              }
                              footer=<div className="text-sm font-medium mt-1">
                                {newDueBy
                                  ? `Due by: ${newDueBy.toLocaleString()}`
                                  : "Select a due by date."}
                              </div>
                            />
                          </PopoverContent>
                        </Popover>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateAction(
                              action.id,
                              editBody,
                              editStatus,
                              editDueBy
                            )
                          }
                        >
                          Save
                        </Button>
                        {/* TODO: add a circular X button to cancel updating */}
                      </div>
                    ) : (
                      action.body
                    )}
                  </TableCell>
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
                      .toLocaleString(DateTime.DATETIME_MED)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {action.updated_at
                      .setLocale(siteConfig.locale)
                      .toLocaleString(DateTime.DATETIME_MED)}
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
                            setEditingId(action.id);
                            setEditBody(action.body ?? "");
                            setEditStatus(action.status);
                            setEditDueBy(action.due_by);
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
        {/* Create a new action */}
        <div className="flex items-center space-x-2">
          <Input
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addAction()}
            placeholder="Enter new action"
            className="flex-grow"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !newDueBy && "text-muted-foreground"
                )}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                {editDueBy ? (
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
          <Button onClick={addAction}>Save</Button>
        </div>
      </div>
    </div>
  );
};

export { ActionsList };
