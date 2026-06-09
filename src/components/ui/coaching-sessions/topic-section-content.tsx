"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { TextCursorInput, GripVertical, Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/lib/utils";
import { TopicRatings } from "@/components/ui/coaching-sessions/topic-rating-chip";
import { TopicAuthorBadge } from "@/components/ui/coaching-sessions/topic-provenance";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import type { TopicImmediacy, TopicRelevance } from "@/types/coaching-session-topic";
import type { Id } from "@/types/general";
import { type Option, None } from "@/types/option";
import type { DateTime } from "ts-luxon";

export interface TopicSectionContentProps {
  topics: CoachingSessionTopic[];
  viewerId: Id;
  onCreate: (body: string) => void;
  onEdit: (id: Id, body: string) => void;
  onDelete: (id: Id) => void;
  onReorder: (orderedIds: Id[]) => void;
  readOnly?: boolean;
  /** True only for the coachee; chips render read-only otherwise. */
  canRate?: boolean;
  onRate?: (
    id: Id,
    fields: { relevance?: TopicRelevance; immediacy?: TopicImmediacy }
  ) => void;
  /** Inserts the topic body into the coaching notes as an H3 heading. */
  onInsertToNotes?: (body: string) => void;
  /** Resolves a topic author's user id to a display name for the badge. */
  resolveAuthorName?: (userId: Id) => string;
  /** FE-derived previous-session anchor; drives the "new since" dot. */
  previousSessionDate?: Option<DateTime>;
}

const initials = (userId: Id): string =>
  userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Whole-list reorder: returns the FULL ordered id list after moving `activeId`
 * to where `overId` sits. Order is conveyed by array position. No-op (returns a
 * copy in the original order) when either id is missing or they are the same.
 * Never mutates the input.
 */
export function reorderTopicIds(
  orderedIds: Id[],
  activeId: Id,
  overId: Id
): Id[] {
  const from = orderedIds.indexOf(activeId);
  const to = orderedIds.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return orderedIds.slice();
  return arrayMove(orderedIds.slice(), from, to);
}

function TopicRow({
  topic,
  isAuthor,
  viewerId,
  authorName,
  previousSessionDate,
  readOnly,
  canRate,
  onEdit,
  onDelete,
  onRate,
  onInsertToNotes,
}: {
  topic: CoachingSessionTopic;
  isAuthor: boolean;
  viewerId: Id;
  authorName: string;
  previousSessionDate: Option<DateTime>;
  readOnly: boolean;
  canRate: boolean;
  onEdit: (id: Id, body: string) => void;
  onDelete: (id: Id) => void;
  onRate: (
    id: Id,
    fields: { relevance?: TopicRelevance; immediacy?: TopicImmediacy }
  ) => void;
  onInsertToNotes?: (body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.body);

  const { attributes, listeners, setNodeRef: dragRef, isDragging } =
    useDraggable({ id: topic.id });
  const { setNodeRef: dropRef, isOver, active } = useDroppable({ id: topic.id });
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      dragRef(node);
      dropRef(node);
    },
    [dragRef, dropRef]
  );
  const showDropLine = isOver && active?.id !== topic.id;

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
    <div
      ref={readOnly ? undefined : setRef}
      className={cn(
        "group/topic relative flex items-start gap-2 rounded-lg border bg-card px-2 py-1.5 transition-colors",
        showDropLine ? "border-foreground/30" : "border-border/50 hover:border-border",
        isDragging && "opacity-40"
      )}
    >
      {showDropLine && (
        <span className="absolute -top-[5px] left-3 right-3 h-0.5 rounded-full bg-foreground/40" />
      )}

      {!readOnly && (
        <button
          type="button"
          aria-label="Reorder topic"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <TopicAuthorBadge
        authorName={authorName}
        authorId={topic.user_id}
        viewerId={viewerId}
        createdAt={topic.created_at}
        updatedAt={topic.updated_at}
        previousSessionDate={previousSessionDate}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {editing && !readOnly ? (
          <Textarea
            autoFocus
            aria-label="Edit topic"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter commits; Shift+Enter inserts a newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") cancel();
            }}
            onBlur={commit}
            className="min-h-[3.5rem] resize-none text-[13px] leading-snug"
          />
        ) : (
          <button
            type="button"
            onClick={readOnly ? undefined : () => setEditing(true)}
            disabled={readOnly}
            className={cn(
              "rounded-md px-1.5 py-1 text-left text-[13px] leading-snug transition-colors",
              !readOnly && "hover:bg-muted/50"
            )}
          >
            <span className="line-clamp-3">{topic.body}</span>
          </button>
        )}

        {!editing && (
          <div className="flex items-center gap-1.5 px-1.5">
            <TopicRatings
              relevance={topic.relevance}
              immediacy={topic.immediacy}
              editable={canRate && !readOnly}
              onRelevance={(v) => onRate(topic.id, { relevance: v })}
              onImmediacy={(v) => onRate(topic.id, { immediacy: v })}
            />

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {!readOnly && onInsertToNotes && (
                <button
                  type="button"
                  aria-label="Insert into notes"
                  title="Insert into notes at the cursor"
                  onClick={() => onInsertToNotes(topic.body)}
                  className="rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/topic:opacity-100"
                >
                  <TextCursorInput className="h-4 w-4" />
                </button>
              )}

              {isAuthor && !readOnly && (
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
  onReorder,
  readOnly = false,
  canRate = false,
  onRate = () => {},
  onInsertToNotes,
  resolveAuthorName = () => "",
  previousSessionDate = None,
}: TopicSectionContentProps) {
  const [newBody, setNewBody] = useState("");
  const [activeId, setActiveId] = useState<Id | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );
  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeId) ?? null,
    [topics, activeId]
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onReorder(
        reorderTopicIds(
          topics.map((t) => t.id),
          String(active.id),
          String(over.id)
        )
      );
    }
    setActiveId(null);
  };

  const add = () => {
    const trimmed = newBody.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewBody("");
  };

  // Grow the add-topic input with its content up to MAX_ADD_ROWS, then scroll.
  const MAX_ADD_ROWS = 3;
  const addInputRef = useRef<HTMLTextAreaElement>(null);
  const autosizeAddInput = useCallback(() => {
    const el = addInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 18;
    const paddingY =
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderY =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const maxHeight = lineHeight * MAX_ADD_ROWS + paddingY + borderY;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);
  // Re-measure on every value change — covers both typing and the reset after add.
  useEffect(() => autosizeAddInput(), [newBody, autosizeAddInput]);

  const rows = topics.map((topic) => (
    <TopicRow
      key={topic.id}
      topic={topic}
      isAuthor={viewerId === topic.user_id}
      viewerId={viewerId}
      authorName={resolveAuthorName(topic.user_id)}
      previousSessionDate={previousSessionDate}
      readOnly={readOnly}
      canRate={canRate}
      onEdit={onEdit}
      onDelete={onDelete}
      onRate={onRate}
      onInsertToNotes={onInsertToNotes}
    />
  ));

  return (
    <div className="space-y-2">
      {topics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
          <p className="text-sm text-muted-foreground/60 italic">
            No topics yet. Add what you&apos;d like to focus on this session.
          </p>
        </div>
      ) : readOnly ? (
        <div className="space-y-2">{rows}</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="space-y-2">{rows}</div>

          <DragOverlay>
            {activeTopic ? (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-2 py-1.5 shadow-lg">
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                  <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
                    {initials(activeTopic.user_id)}
                  </AvatarFallback>
                </Avatar>
                <span className="px-1.5 py-1 text-[13px] leading-snug line-clamp-3">
                  {activeTopic.body}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {!readOnly && (
        <div className="flex items-end gap-2 pt-3">
          <Textarea
            ref={addInputRef}
            rows={1}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; Shift+Enter inserts a newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a topic…"
            className="min-h-9 resize-none py-2 text-[13px] leading-snug"
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
