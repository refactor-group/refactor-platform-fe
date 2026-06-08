"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/lib/utils";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import type { Id } from "@/types/general";

export interface TopicSectionContentProps {
  topics: CoachingSessionTopic[];
  viewerId: Id;
  onCreate: (body: string) => void;
  onEdit: (id: Id, body: string) => void;
  onDelete: (id: Id) => void;
  readOnly?: boolean;
}

const initials = (userId: Id): string =>
  userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

function TopicRow({
  topic,
  isAuthor,
  readOnly,
  onEdit,
  onDelete,
}: {
  topic: CoachingSessionTopic;
  isAuthor: boolean;
  readOnly: boolean;
  onEdit: (id: Id, body: string) => void;
  onDelete: (id: Id) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.body);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== topic.body) onEdit(topic.id, trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(topic.body);
    setEditing(false);
  };

  return (
    <div className="group/topic flex items-start gap-2 rounded-lg border border-border/50 bg-card px-2 py-1.5 transition-colors hover:border-border">
      <Avatar className="mt-0.5 h-6 w-6 shrink-0">
        <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
          {initials(topic.user_id)}
        </AvatarFallback>
      </Avatar>

      {editing && !readOnly ? (
        <Input
          autoFocus
          aria-label="Edit topic"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
          className="h-8 flex-1 text-[13px]"
        />
      ) : (
        <button
          type="button"
          onClick={readOnly ? undefined : () => setEditing(true)}
          disabled={readOnly}
          className={cn(
            "flex-1 rounded-md px-1.5 py-1 text-left text-[13px] leading-snug transition-colors",
            !readOnly && "hover:bg-muted/50"
          )}
        >
          <span className="line-clamp-3">{topic.body}</span>
        </button>
      )}

      <div className="flex w-7 shrink-0 justify-end">
        {isAuthor && !readOnly && !editing && (
          <button
            type="button"
            aria-label="Delete topic"
            onClick={() => onDelete(topic.id)}
            className="rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/topic:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function TopicSectionContent({
  topics,
  viewerId,
  onCreate,
  onEdit,
  onDelete,
  readOnly = false,
}: TopicSectionContentProps) {
  const [newBody, setNewBody] = useState("");

  const add = () => {
    const trimmed = newBody.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewBody("");
  };

  return (
    <div className="space-y-2">
      {topics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
          <p className="text-sm text-muted-foreground/60 italic">
            No topics yet. Add what you&apos;d like to focus on this session.
          </p>
        </div>
      ) : (
        topics.map((topic) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            isAuthor={viewerId === topic.user_id}
            readOnly={readOnly}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Add a topic…"
            className="h-9 text-[13px]"
          />
          <Button
            size="sm"
            className="h-9 shrink-0"
            aria-label="Add topic"
            disabled={!newBody.trim()}
            onClick={add}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
