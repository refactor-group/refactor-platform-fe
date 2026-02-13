"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AssigneeSelector,
  AssignmentType,
} from "@/components/ui/assignee-selector";
import type { AssigneeOption, AssigneeSelection } from "@/components/ui/assignee-selector";
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

/** Convert an AssigneeSelection + options into an array of user IDs */
function selectionToAssigneeIds(
  selection: AssigneeSelection,
  options: AssigneeOption[]
): Id[] | undefined {
  if (selection === AssignmentType.Unselected || selection === AssignmentType.None) {
    return undefined;
  }
  if (selection === AssignmentType.Both) {
    return options.map((o) => o.id);
  }
  // Individual user ID
  return [selection];
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
  const [assigneeSelection, setAssigneeSelection] =
    useState<AssigneeSelection>(AssignmentType.Unselected);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const assigneeOptions: AssigneeOption[] = [
    { id: coachId, name: coachName },
    { id: coacheeId, name: coacheeName },
  ].filter((o) => o.id);

  const handleSave = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    setIsSaving(true);
    try {
      const assigneeIds = selectionToAssigneeIds(
        assigneeSelection,
        assigneeOptions
      );
      await onCreateAction(trimmed, ItemStatus.NotStarted, dueBy, assigneeIds);
      // Reset form on success
      setBody("");
      setDueBy(DateTime.now().plus({ days: 7 }));
      setAssigneeSelection(AssignmentType.Unselected);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setBody("");
    setDueBy(DateTime.now().plus({ days: 7 }));
    setAssigneeSelection(AssignmentType.Unselected);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Card className="border-2 border-dashed border-primary/30">
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

          {/* Assignee + Due date row */}
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeSelector
              value={assigneeSelection}
              onValueChange={setAssigneeSelection}
              options={assigneeOptions}
              placeholder="Assignee"
              className="w-36"
              disabled={isSaving}
            />

            <Popover>
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
                  onSelect={(date: Date | undefined) =>
                    date && setDueBy(DateTime.fromJSDate(date))
                  }
                />
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

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      disabled={disabled}
      className="w-full rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center gap-2 py-4 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus className="h-5 w-5" />
      <span className="text-sm">Add action</span>
    </button>
  );
};

export { GhostActionCard };
export type { GhostActionCardProps };
