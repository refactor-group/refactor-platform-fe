"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Maximize2, Trash2 } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CoachingSessionImageApi } from "@/lib/api/coaching-session-images";
import { type Option, Some, None } from "@/types/option";

const ALT_TEXT_DEBOUNCE_MS = 400;

const HOVER_REVEAL_CLASS =
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:transition-opacity";

type LoadState = { kind: "loading" } | { kind: "loaded" } | { kind: "error" };

function attributeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function attributeDimension(value: unknown): Option<number> {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Some(value)
    : None;
}

/**
 * The box the image occupies, when the upload recorded one. Reserving it keeps the note
 * from reflowing as images load, and keeps the unavailable placeholder the same size as
 * the image it stands in for.
 *
 * Shaped to match how the image itself is laid out: fill the available width, but never
 * exceed the image's own pixel width, and take the height from the aspect ratio. A fixed
 * `width` here instead would stop the placeholder shrinking in a narrow editor, and would
 * push a large image's box straight out of the column.
 */
function reservedBox(
  width: Option<number>,
  height: Option<number>
): CSSProperties | undefined {
  if (!width.some || !height.some) return undefined;
  return {
    width: "100%",
    maxWidth: width.val,
    aspectRatio: `${width.val} / ${height.val}`,
  };
}

/** Past this, a press becomes a drag rather than a click. */
const DRAG_THRESHOLD_PX = 5;

/**
 * Where a dragged image would land, and where to draw the line saying so.
 *
 * Top-level blocks only. An image is a block node, and the drop is always between
 * blocks, so resolving against the document's own children avoids the ambiguity of
 * `posAtCoords` inside nested content.
 */
interface DropTarget {
  pos: number;
  left: number;
  top: number;
  width: number;
}

type BestTarget = DropTarget & { distance: number };

function dropTargetAt(editor: Editor, clientY: number): Option<DropTarget> {
  const view = editor.view;
  const candidates: BestTarget[] = [];

  view.state.doc.forEach((node: ProseMirrorNode, offset: number) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    const above = clientY < rect.top + rect.height / 2;
    const edge = above ? rect.top : rect.bottom;
    candidates.push({
      pos: above ? offset : offset + node.nodeSize,
      left: rect.left,
      top: edge,
      width: rect.width,
      distance: Math.abs(clientY - edge),
    });
  });

  if (candidates.length === 0) return None;
  const best = candidates.reduce((a, b) => (b.distance < a.distance ? b : a));
  return Some({ pos: best.pos, left: best.left, top: best.top, width: best.width });
}

let dropLine: HTMLElement | undefined;

/** The only thing visible during a drag: no preview of the image follows the cursor. */
function showDropLine(target: DropTarget): void {
  if (!dropLine?.isConnected) {
    dropLine = document.createElement("div");
    // Same class the Dropcursor extension uses for file drags, so both look alike.
    dropLine.className = "coaching-notes-dropcursor";
    dropLine.style.position = "fixed";
    dropLine.style.height = "3px";
    dropLine.style.pointerEvents = "none";
    dropLine.style.zIndex = "50";
    document.body.appendChild(dropLine);
  }
  dropLine.style.left = `${target.left}px`;
  dropLine.style.top = `${target.top - 1}px`;
  dropLine.style.width = `${target.width}px`;
  dropLine.style.display = "block";
}

function hideDropLine(): void {
  if (dropLine) dropLine.style.display = "none";
}

/** Move `node` from `from` to `target`, as one transaction so it reads as a move. */
function moveNode(editor: Editor, from: number, target: number): void {
  const node = editor.state.doc.nodeAt(from);
  if (!node) return;
  const to = from + node.nodeSize;
  // Dropped back onto itself: nothing to do, and the arithmetic below would not hold.
  if (target >= from && target <= to) return;

  const tr = editor.state.tr.delete(from, to);
  tr.insert(tr.mapping.map(target), node);
  editor.view.dispatch(tr.scrollIntoView());
}

export function NoteImageView({
  node,
  selected,
  deleteNode,
  updateAttributes,
  editor,
  getPos,
}: NodeViewProps) {
  const imageId = attributeString(node.attrs.imageId);
  const alt = attributeString(node.attrs.alt);
  const src = CoachingSessionImageApi.imageUrl(imageId);
  const naturalWidth = attributeDimension(node.attrs.naturalWidth);
  const naturalHeight = attributeDimension(node.attrs.naturalHeight);
  const box = reservedBox(naturalWidth, naturalHeight);

  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const press = useRef<Option<{ x: number; y: number; pointerId: number; moved: boolean }>>(None);
  const target = useRef<Option<number>>(None);

  // Moving an image is driven by pointer events rather than HTML5 drag, so the browser
  // never composites a drag preview. There is no translucent copy to suppress, because
  // none is ever created: the drop line below is the only thing the drag draws.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // The hover controls are buttons, not drag surfaces.
    if ((event.target as HTMLElement).closest("button")) return;
    press.current = Some({ x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!press.current.some) return;
    const state = press.current.val;

    if (!state.moved) {
      const travelled = Math.hypot(event.clientX - state.x, event.clientY - state.y);
      if (travelled < DRAG_THRESHOLD_PX) return;
      state.moved = true;
      wrapperRef.current?.setPointerCapture(state.pointerId);
      setDragging(true);
    }

    const found = dropTargetAt(editor, event.clientY);
    target.current = found.some ? Some(found.val.pos) : None;
    if (found.some) showDropLine(found.val);
  };

  const endPress = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!press.current.some) return;
    const state = press.current.val;
    press.current = None;
    hideDropLine();
    if (!state.moved) return;

    wrapperRef.current?.releasePointerCapture(state.pointerId);
    setDragging(false);
    // Stop the click this pointer sequence would otherwise produce, which would
    // reselect the node at its old position.
    event.preventDefault();

    const from = getPos();
    if (typeof from === "number" && target.current.some) {
      moveNode(editor, from, target.current.val);
    }
    target.current = None;
  };

  useEffect(() => hideDropLine, []);

  return (
    <NodeViewWrapper
      as="div"
      ref={wrapperRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      className={cn(
        "note-image group relative my-4",
        // Shrink-wrapped around the image normally. The placeholder has no intrinsic
        // width to wrap, so in that state the wrapper spans the column and the
        // placeholder's own max-width does the constraining.
        loadState.kind === "error" ? "w-full" : "w-fit",
        selected && "is-selected",
        // The source dims so it is clear what is moving. This is not a preview: it
        // stays exactly where it is until the drop.
        dragging && "opacity-50"
      )}
    >
      {/* next/image cannot serve a cookie-authorized backend redirect. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={naturalWidth.some ? naturalWidth.val : undefined}
        height={naturalHeight.some ? naturalHeight.val : undefined}
        // Native image dragging would reintroduce the browser's own preview.
        draggable={false}
        className={cn(
          "note-image__img",
          dragging ? "cursor-grabbing" : "cursor-grab",
          loadState.kind === "error" && "hidden"
        )}
        onLoad={() => setLoadState({ kind: "loaded" })}
        onError={() => setLoadState({ kind: "error" })}
      />
      {loadState.kind === "error" && <NoteImageUnavailable style={box} />}
      <ImageControls
        onOpenFullSize={() => setLightboxOpen(true)}
        onDelete={deleteNode}
      />
      {selected && (
        <AltTextField
          value={alt}
          onCommit={(value) => updateAttributes({ alt: value })}
        />
      )}
      <NoteImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        src={src}
        alt={alt}
      />
    </NodeViewWrapper>
  );
}

function NoteImageUnavailable({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={style}
      className="note-image__unavailable flex max-w-full items-center justify-center rounded-lg border border-border bg-muted/20 px-6 py-8"
    >
      <span className="text-sm text-muted-foreground">
        This image isn&apos;t available right now.
      </span>
    </div>
  );
}

interface ImageControlsProps {
  onOpenFullSize: () => void;
  onDelete: () => void;
}

/**
 * The hover controls. Opening full size is a button rather than a plain click on the
 * image, because a click has to be free to select the node: selecting is what reveals
 * the description field, and with the lightbox bound to click it opened over the field
 * every time.
 */
function ImageControls({ onOpenFullSize, onDelete }: ImageControlsProps) {
  return (
    <div className={cn("absolute right-2 top-2 flex gap-1", HOVER_REVEAL_CLASS)}>
      <ImageControlButton
        label="View image full size"
        onClick={onOpenFullSize}
        icon={<Maximize2 />}
      />
      {/* Removes the node only. The stored bytes stay so undo restores a working image. */}
      <ImageControlButton
        label="Remove image from note"
        onClick={onDelete}
        icon={<Trash2 />}
      />
    </div>
  );
}

function ImageControlButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={cn(
        // rounded-md is the app's standard control radius; circular icon buttons are
        // reserved for the avatar.
        "rounded-md h-7 w-7 border border-border bg-background/90 text-muted-foreground/70 hover:text-foreground"
      )}
    >
      {icon}
    </Button>
  );
}

interface AltTextFieldProps {
  value: string;
  onCommit: (value: string) => void;
}

function AltTextField({ value, onCommit }: AltTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const commitRef = useRef(onCommit);
  const pending = useRef({ draft, value });

  useEffect(() => {
    commitRef.current = onCommit;
    pending.current = { draft, value };
  });

  // Every write is a replicated Yjs update, so keystrokes are coalesced.
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commitRef.current(draft), ALT_TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value]);

  // This field only exists while the node is selected, so clicking away unmounts it and
  // the cleanup above cancels a commit that has not fired yet. Without this, typing a
  // description and immediately clicking elsewhere loses it silently, having shown the
  // user their own text in the field the whole time.
  useEffect(
    () => () => {
      const { draft: last, value: committed } = pending.current;
      if (last !== committed) commitRef.current(last);
    },
    []
  );

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) commitRef.current(draft);
      }}
      aria-label="Image description"
      placeholder="Describe this image"
      className="mt-2 h-8 text-xs"
    />
  );
}

/**
 * The shared dialog's close button has no background and sits at 70% opacity. That reads
 * fine on a solid dialog surface, but this one is transparent so the X lands straight on
 * the image and disappears over anything dark. Give it its own opaque surface.
 */
const LIGHTBOX_CLOSE_BUTTON = [
  "[&>button]:opacity-100",
  "[&>button]:rounded-md",
  "[&>button]:border",
  "[&>button]:border-border",
  "[&>button]:bg-background",
  "[&>button]:text-foreground",
  "[&>button]:p-1.5",
  "[&>button]:shadow-sm",
  "[&>button:hover]:bg-accent",
].join(" ");

interface NoteImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
}

function NoteImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
}: NoteImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[90vw] border-0 bg-transparent p-0 shadow-none sm:max-w-[90vw]",
          LIGHTBOX_CLOSE_BUTTON
        )}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-[85vh] w-auto rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}
