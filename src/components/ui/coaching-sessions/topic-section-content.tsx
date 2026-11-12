"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
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
import { TopicStatusControls } from "@/components/ui/coaching-sessions/topic-status-controls";
import {
  TopicAuthorBadge,
  nameInitials,
} from "@/components/ui/coaching-sessions/topic-provenance";
import { useAutosizeTextarea } from "@/lib/hooks/use-autosize-textarea";
import { TopicStatus } from "@/types/coaching-session-topic";
import type {
  CoachingSessionTopic,
  LastViewedAnchor,
} from "@/types/coaching-session-topic";
import type { Id } from "@/types/general";

export interface TopicSectionContentProps {
  topics: CoachingSessionTopic[];
  viewerId: Id;
  onCreate: (body: string) => void;
  onEdit: (id: Id, body: string) => void;
  onDelete: (id: Id) => void;
  onReorder: (orderedIds: Id[]) => void;
  readOnly?: boolean;
  /** Disables only the add-new-topic affordance (e.g. after the session ends),
   *  while existing topics stay editable. Independent of `readOnly`. */
  addDisabled?: boolean;
  /** True for the coach: may delete ANY topic, not just their own. */
  canDeleteAny?: boolean;
  /** Lifecycle (Open/Discussed/Deferred) — either participant may set it. */
  onStatus?: (id: Id, status: TopicStatus) => void;
  /** Inserts the topic body into the coaching notes as an H3 heading. */
  onInsertToNotes?: (body: string) => void;
  /** Resolves a topic author's user id to a display name for the badge. */
  resolveAuthorName?: (userId: Id) => string;
  /** Viewer's read-state for this session; drives the "new since" dot. */
  viewedAnchor?: LastViewedAnchor;
}

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

// Memoized so a list-level re-render (e.g. one topic's status changing)
// repaints only the row whose props actually changed, not every row.
// Row actions: the 28px menu icon button, faint, shown on hover or focus.
const TOPIC_ROW_ICON =
  "text-faint opacity-0 transition-opacity focus-visible:opacity-100 group-hover/topic:opacity-100";

const TopicRow = memo(function TopicRow({
  topic,
  isAuthor,
  viewerId,
  authorName,
  viewedAnchor,
  readOnly,
  canDeleteAny,
  onEdit,
  onDelete,
  onStatus,
  onInsertToNotes,
}: {
  topic: CoachingSessionTopic;
  isAuthor: boolean;
  viewerId: Id;
  authorName: string;
  viewedAnchor: LastViewedAnchor;
  readOnly: boolean;
  canDeleteAny: boolean;
  onEdit: (id: Id, body: string) => void;
  onDelete: (id: Id) => void;
  onStatus: (id: Id, status: TopicStatus) => void;
  onInsertToNotes?: (body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.body);

  // Auto-size the edit textarea to its content (cap 3 rows, then scroll) so it
  // matches the display label's height exactly — no bounce when toggling edit.
  const editRef = useRef<HTMLTextAreaElement>(null);
  useAutosizeTextarea(editRef, draft, 3, editing);

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
  const discussed = topic.status === TopicStatus.Discussed;

  const startEditing = () => {
    setDraft(topic.body);
    setEditing(true);
  };

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
        "group/topic relative flex items-start gap-2 rounded-xl border bg-card px-2 py-2 transition-colors",
        showDropLine ? "border-foreground/30" : "border-border hover:border-border-hover",
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
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded-full p-1 text-faint transition-colors hover:text-muted-foreground active:cursor-grabbing"
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
        viewedAnchor={viewedAnchor}
        isMovedOver={topic.moved_from_session_id.some}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {editing && !readOnly ? (
          <Textarea
            ref={editRef}
            autoFocus
            aria-label="Edit topic"
            rows={1}
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
            // Match the display label's box model (px-1.5 py-1, no border) so
            // the card height is identical in display and edit.
            className="min-h-0 resize-none rounded-input border-0 px-1.5 py-1 text-item leading-snug shadow-none"
          />
        ) : (
          <button
            type="button"
            onClick={readOnly ? undefined : startEditing}
            disabled={readOnly}
            className={cn(
              "rounded-input px-1.5 py-1 text-left text-item leading-snug transition-colors",
              !readOnly && "hover:bg-well"
            )}
          >
            <span
              className={cn(
                "line-clamp-3",
                // Faded, never struck through: the design system has no strikethrough.
                discussed && "text-muted-foreground/60"
              )}
            >
              {topic.body}
            </span>
          </button>
        )}

        {/* Always render the action row — keeping it visible while editing
            keeps the card's footprint stable instead of jumping. */}
        <div className="flex items-center gap-1.5 px-1.5">
          <TopicStatusControls
            status={topic.status}
            editable={!readOnly}
            onChange={(s) => onStatus(topic.id, s)}
          />

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {!readOnly && onInsertToNotes && (
              <Button
                type="button"
                variant="ghost"
                size="icon-menu"
                aria-label="Insert into notes"
                title="Insert into notes at the cursor"
                onClick={() => onInsertToNotes(topic.body)}
                className={TOPIC_ROW_ICON}
              >
                <TextCursorInput aria-hidden />
              </Button>
            )}

            {(isAuthor || canDeleteAny) && !readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon-menu"
                aria-label="Delete topic"
                onClick={() => onDelete(topic.id)}
                className={cn(TOPIC_ROW_ICON, "hover:bg-destructive/10 hover:text-destructive")}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export function TopicSectionContent({
  topics,
  viewerId,
  onCreate,
  onEdit,
  onDelete,
  onReorder,
  readOnly = false,
  addDisabled = false,
  canDeleteAny = false,
  onStatus = () => {},
  onInsertToNotes,
  resolveAuthorName = () => "",
  viewedAnchor = { kind: "loading" },
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
    if (addDisabled) return;
    const trimmed = newBody.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewBody("");
  };

  // Grow the add-topic input with its content up to MAX_ADD_ROWS, then scroll.
  const MAX_ADD_ROWS = 3;
  const addInputRef = useRef<HTMLTextAreaElement>(null);
  useAutosizeTextarea(addInputRef, newBody, MAX_ADD_ROWS);

  const rows = topics.map((topic) => (
    <TopicRow
      key={topic.id}
      topic={topic}
      isAuthor={viewerId === topic.user_id}
      viewerId={viewerId}
      authorName={resolveAuthorName(topic.user_id)}
      viewedAnchor={viewedAnchor}
      readOnly={readOnly}
      canDeleteAny={canDeleteAny}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatus={onStatus}
      onInsertToNotes={onInsertToNotes}
    />
  ));

  return (
    <div className="space-y-2">
      {topics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-6 px-4 text-center">
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
              <div className="flex items-start gap-2 rounded-xl border border-border-hover bg-card px-2 py-2 shadow-popover">
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                  <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
                    {nameInitials(resolveAuthorName(activeTopic.user_id))}
                  </AvatarFallback>
                </Avatar>
                <span className="px-1.5 py-1 text-item leading-snug line-clamp-3">
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
            disabled={addDisabled}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; Shift+Enter inserts a newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a topic…"
            className="min-h-9 resize-none rounded-input py-2 text-item leading-snug"
          />
          <Button
            size="sm"
            className="h-9 shrink-0"
            aria-label="Add topic"
            disabled={addDisabled || !newBody.trim()}
            onClick={add}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
