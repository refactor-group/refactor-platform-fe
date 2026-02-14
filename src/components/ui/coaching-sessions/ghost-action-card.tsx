"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarIcon, Plus } from "lucide-react";
import { ItemStatus, Id } from "@/types/general";
import type { Action } from "@/types/action";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";
import { siteConfig } from "@/site.config";

interface GhostActionCardProps {
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onCreateAction: (
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  disabled?: boolean;
}

/** Derive initials from a display name (e.g. "Alex Rivera" -> "AR") */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

const GhostActionCard = ({
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onCreateAction,
  disabled = false,
}: GhostActionCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState("");
  const [dueBy, setDueBy] = useState<DateTime>(
    DateTime.now().plus({ days: 7 })
  );
  const [assigneeIds, setAssigneeIds] = useState<Id[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const allAssignees = [
    { id: coachId, name: coachName, initials: getInitials(coachName) },
    { id: coacheeId, name: coacheeName, initials: getInitials(coacheeName) },
  ].filter((a) => a.id);

  const resolvedAssignees = assigneeIds
    .map((id) => allAssignees.find((a) => a.id === id))
    .filter(
      (a): a is { id: Id; name: string; initials: string } => a !== undefined
    );

  const handleAssigneeToggle = (assigneeId: Id) => {
    const isAssigned = assigneeIds.includes(assigneeId);
    setAssigneeIds(
      isAssigned
        ? assigneeIds.filter((id) => id !== assigneeId)
        : [...assigneeIds, assigneeId]
    );
  };

  const handleSave = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    setIsSaving(true);
    try {
      await onCreateAction(
        trimmed,
        ItemStatus.NotStarted,
        dueBy,
        assigneeIds.length > 0 ? assigneeIds : undefined
      );
      // Reset form on success
      setBody("");
      setDueBy(DateTime.now().plus({ days: 7 }));
      setAssigneeIds([]);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setBody("");
    setDueBy(DateTime.now().plus({ days: 7 }));
    setAssigneeIds([]);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Card className="max-w-2xl border-2 border-dashed border-primary/30">
        <CardContent className="flex flex-col gap-3 p-4">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") {
                handleCancel();
              }
            }}
            placeholder="What needs to be done?"
            className="flex-1 resize-none rounded border border-input bg-background px-2 py-1 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            disabled={isSaving}
          />

          {/* Due date + Assignee row */}
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 text-xs gap-1.5",
                    !dueBy && "text-muted-foreground"
                  )}
                  disabled={isSaving}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dueBy
                    .setLocale(siteConfig.locale)
                    .toLocaleString(DateTime.DATE_MED)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueBy.toJSDate()}
                  onSelect={(date: Date | undefined) => {
                    if (date) {
                      setDueBy(DateTime.fromJSDate(date));
                      setCalendarOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Assignee avatar stack with popover */}
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex -space-x-2 cursor-pointer hover:opacity-80"
                      disabled={isSaving}
                    >
                      {resolvedAssignees.length > 0 ? (
                        resolvedAssignees.map((assignee) => (
                          <Avatar
                            key={assignee.id}
                            className="h-8 w-8 border-2 border-background"
                          >
                            <AvatarFallback className="text-[11px]">
                              {assignee.initials}
                            </AvatarFallback>
                          </Avatar>
                        ))
                      ) : (
                        <Avatar className="h-8 w-8 border-2 border-dashed border-muted-foreground/50">
                          <AvatarFallback className="text-[11px] text-muted-foreground">
                            +
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Assignees</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-48 p-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Assignees
                  </span>
                  {allAssignees.map((assignee) => {
                    const isAssigned = assigneeIds.includes(assignee.id);
                    return (
                      <div
                        key={assignee.id}
                        role="option"
                        aria-selected={isAssigned}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                        onClick={() => handleAssigneeToggle(assignee.id)}
                      >
                        <Checkbox checked={isAssigned} />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {assignee.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{assignee.name}</span>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Save / Cancel */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !body.trim()}
            >
              {isSaving ? "Saving..." : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData("text/plain").trim();
    if (text && !disabled) {
      setBody(text);
      setIsEditing(true);
    }
  };

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      disabled={disabled}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "max-w-2xl w-full rounded-xl border-2 border-dashed flex items-center justify-center gap-2 py-4 text-muted-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        isDragOver
          ? "border-primary bg-primary/5 text-foreground"
          : "border-muted-foreground/25 hover:border-primary/50 hover:text-foreground"
      )}
    >
      <Plus className="h-5 w-5" />
      <span className="text-sm">{isDragOver ? "Drop to create action" : "Add action"}</span>
    </button>
  );
};

export { GhostActionCard };
export type { GhostActionCardProps };
