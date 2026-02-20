"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { ItemStatus, Id, actionStatusToString } from "@/types/general";
import type { Action } from "@/types/action";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";

import {
  resolveAssignees,
  AssigneePickerPopover,
  DueDatePicker,
} from "@/components/ui/coaching-sessions/action-card-parts";

interface SessionActionCardProps {
  action: Action;
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => void;
  onDelete?: (id: Id) => void;
  variant?: "current" | "previous";
  /** Show session link even when variant is "current" (e.g. kanban board) */
  showSessionLink?: boolean;
  /** Session date shown in "From:" link when showSessionLink is true */
  sessionDate?: DateTime;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the Tailwind color class for the status dot */
function statusDotColor(status: ItemStatus): string {
  switch (status) {
    case ItemStatus.NotStarted:
      return "bg-muted-foreground";
    case ItemStatus.InProgress:
      return "bg-green-500";
    case ItemStatus.Completed:
      return "bg-primary";
    case ItemStatus.WontDo:
      return "bg-red-400";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusSelectProps {
  status: ItemStatus;
  onStatusChange: (newStatus: ItemStatus) => void;
}

function StatusSelect({ status, onStatusChange }: StatusSelectProps) {
  return (
    <Select
      value={status}
      onValueChange={(value) => onStatusChange(value as ItemStatus)}
    >
      <SelectTrigger
        className="h-6 w-auto gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent [&>svg]:h-3 [&>svg]:w-3"
      >
        <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(status))} />
        {actionStatusToString(status)}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ItemStatus.NotStarted}>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.NotStarted))} />
            Not Started
          </span>
        </SelectItem>
        <SelectItem value={ItemStatus.InProgress}>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.InProgress))} />
            In Progress
          </span>
        </SelectItem>
        <SelectItem value={ItemStatus.Completed}>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.Completed))} />
            Completed
          </span>
        </SelectItem>
        <SelectItem value={ItemStatus.WontDo}>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.WontDo))} />
            Won&apos;t Do
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

interface DeleteConfirmButtonProps {
  onDelete: () => void;
}

function DeleteConfirmButton({ onDelete }: DeleteConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="!h-[18px] !w-[18px]" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete action</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this action? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ActionBodyProps {
  body: string | undefined;
  isCompleted: boolean;
  isCurrent: boolean;
  onBodyChange: (newBody: string) => void;
}

function ActionBody({ body, isCompleted, isCurrent, onBodyChange }: ActionBodyProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(body ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { resolvedTheme } = useTheme();

  // Sync edit text when body changes externally
  useEffect(() => {
    setEditText(body ?? "");
  }, [body]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (trimmed && trimmed !== (body ?? "")) {
      onBodyChange(trimmed);
    } else {
      setEditText(body ?? "");
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {isCurrent && isEditing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") {
              setEditText(body ?? "");
              setIsEditing(false);
            }
          }}
          className="h-full w-full resize-none rounded-lg bg-muted/50 px-3 py-2 text-sm leading-relaxed border border-black/15 outline-none ring-0 focus:border-black/15 focus:outline-none focus:ring-0"
        />
      ) : (
        <div
          className={cn(
            "text-sm leading-relaxed rounded-lg bg-muted/50 px-3 py-2 prose prose-sm prose-neutral dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_li]:m-0",
            isCompleted && "line-through",
            isCurrent &&
              "cursor-pointer hover:bg-muted/80 transition-colors"
          )}
          onClick={isCurrent ? () => setIsEditing(true) : undefined}
        >
          <ReactMarkdown
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                return match ? (
                  <SyntaxHighlighter
                    style={resolvedTheme === "dark" ? oneDark : oneLight}
                    language={match[1]}
                    PreTag="div"
                    className="!rounded-md !text-xs !my-1"
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code className={cn("rounded bg-muted px-1 py-0.5 text-xs", className)} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {body || "No description"}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

interface ActionFooterProps {
  dueBy: DateTime;
  createdAt: DateTime;
  coachingSessionId: Id;
  locale: string;
  isOverdue: boolean;
  isCurrent: boolean;
  showSessionLink: boolean;
  sessionDate?: DateTime;
  onDueDateChange: (newDueBy: DateTime) => void;
}

function ActionFooter({
  dueBy,
  createdAt,
  coachingSessionId,
  locale,
  isOverdue,
  isCurrent,
  showSessionLink,
  sessionDate,
  onDueDateChange,
}: ActionFooterProps) {
  const showLink = !isCurrent || showSessionLink;
  const displayDate = (sessionDate ?? createdAt)
    .setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  return (
    <div className="mt-auto flex justify-end text-xs text-muted-foreground mr-1">
      <div className="flex items-center gap-1.5">
        <DueDatePicker
          value={dueBy}
          onChange={onDueDateChange}
          locale={locale}
          variant="text"
          isOverdue={isOverdue}
        />
        {showLink && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <Link
              href={`/coaching-sessions/${coachingSessionId}?tab=actions`}
              className="hover:underline hover:text-foreground transition-colors"
            >
              From: {displayDate}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SessionActionCard = ({
  action,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  variant = "current",
  showSessionLink = false,
  sessionDate,
}: SessionActionCardProps) => {
  const now = DateTime.now();
  const isCompleted =
    action.status === ItemStatus.Completed ||
    action.status === ItemStatus.WontDo;
  const isOverdue = !isCompleted && action.due_by < now;
  const isCurrent = variant === "current";

  const assigneeIds = action.assignee_ids ?? [];
  const { allAssignees, resolvedAssignees } = resolveAssignees(
    assigneeIds,
    coachId,
    coachName,
    coacheeId,
    coacheeName
  );

  const handleAssigneeToggle = (assigneeId: Id) => {
    const updated = assigneeIds.includes(assigneeId)
      ? assigneeIds.filter((id) => id !== assigneeId)
      : [...assigneeIds, assigneeId];
    onAssigneesChange(action.id, updated);
  };

  return (
    <Card
      className={cn(
        "rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-card transition-colors h-56 overflow-hidden",
        isOverdue && "bg-red-50/40 dark:bg-red-950/10",
        isCompleted && "opacity-60"
      )}
    >
      <CardContent className="flex h-full flex-col gap-2 p-5">
        {/* Top row: status pill | assignees + delete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusSelect
              status={action.status}
              onStatusChange={(newStatus) => onStatusChange(action.id, newStatus)}
            />
          </div>

          <div className="flex items-center gap-2">
            <AssigneePickerPopover
              allAssignees={allAssignees}
              resolvedAssignees={resolvedAssignees}
              assigneeIds={assigneeIds}
              onToggle={handleAssigneeToggle}
            />
            {isCurrent && onDelete && (
              <DeleteConfirmButton onDelete={() => onDelete(action.id)} />
            )}
          </div>
        </div>

        <ActionBody
          body={action.body}
          isCompleted={isCompleted}
          isCurrent={isCurrent}
          onBodyChange={(newBody) => onBodyChange(action.id, newBody)}
        />

        <ActionFooter
          dueBy={action.due_by}
          createdAt={action.created_at}
          coachingSessionId={action.coaching_session_id}
          locale={locale}
          isOverdue={isOverdue}
          isCurrent={isCurrent}
          showSessionLink={showSessionLink}
          sessionDate={sessionDate}
          onDueDateChange={(newDueBy) => onDueDateChange(action.id, newDueBy)}
        />
      </CardContent>
    </Card>
  );
};

export { SessionActionCard };
export type { SessionActionCardProps };
