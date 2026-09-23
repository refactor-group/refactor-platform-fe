"use client";

import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CoachingSessionImageApi } from "@/lib/api/coaching-session-images";

const ALT_TEXT_DEBOUNCE_MS = 400;

const HOVER_REVEAL_CLASS =
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:transition-opacity";

type LoadState = { kind: "loading" } | { kind: "loaded" } | { kind: "error" };

function attributeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let blankDragPreview: HTMLElement | undefined;

/**
 * The element used as the drag preview, replacing the ghost TipTap sets from a clone of
 * the node. Shared across node views and created once.
 */
function blankDragPreviewElement(): HTMLElement {
  if (blankDragPreview?.isConnected) return blankDragPreview;
  // A transparent 1x1 GIF rather than an empty div, and inside the viewport rather than
  // parked off-screen: Chrome ignores a drag image it has not painted and silently falls
  // back to the default preview, which is the very ghost this exists to hide.
  const element = document.createElement("img");
  element.src = TRANSPARENT_PIXEL;
  element.alt = "";
  element.style.position = "fixed";
  element.style.top = "0";
  element.style.left = "0";
  element.style.width = "1px";
  element.style.height = "1px";
  element.style.pointerEvents = "none";
  document.body.appendChild(element);
  blankDragPreview = element;
  return element;
}

export function NoteImageView({
  node,
  selected,
  deleteNode,
  updateAttributes,
}: NodeViewProps) {
  const imageId = attributeString(node.attrs.imageId);
  const alt = attributeString(node.attrs.alt);
  const src = CoachingSessionImageApi.imageUrl(imageId);

  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // TipTap's node view sets a clone of this node as the drag preview, which is the translucent
  // copy of the image. Its handler is React-delegated at the editor root, so we listen on the
  // document to bubble last and win. Never preventDefault: TipTap must still start the drag.
  useEffect(() => {
    const blankThePreview = (event: DragEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper || !(event.target instanceof Node)) return;
      if (!wrapper.contains(event.target)) return;
      event.dataTransfer?.setDragImage(blankDragPreviewElement(), 0, 0);
    };
    // Create it now rather than mid-drag: an image still decoding when setDragImage runs
    // is ignored, and the ghost comes back.
    blankDragPreviewElement();
    document.addEventListener("dragstart", blankThePreview);
    return () => document.removeEventListener("dragstart", blankThePreview);
  }, []);

  return (
    <NodeViewWrapper
      as="div"
      // TipTap needs this alongside `draggable: true`; without it the browser's own
      // image drag takes over and the drop silently does nothing.
      data-drag-handle
      ref={wrapperRef}
      className={cn("note-image group relative my-4 w-fit", selected && "is-selected")}
    >
      {/* next/image cannot serve a cookie-authorized backend redirect. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        // An <img> is natively draggable, which competes with ProseMirror's drag.
        draggable={false}
        className={cn(
          "note-image__img cursor-zoom-in",
          loadState.kind === "error" && "hidden"
        )}
        onLoad={() => setLoadState({ kind: "loaded" })}
        onError={() => setLoadState({ kind: "error" })}
        onClick={() => setLightboxOpen(true)}
      />
      {loadState.kind === "error" && <NoteImageUnavailable />}
      <DeleteImageButton onDelete={deleteNode} />
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

function NoteImageUnavailable() {
  return (
    <div className="note-image__unavailable flex items-center justify-center rounded-lg border border-border bg-muted/20 px-6 py-8">
      <span className="text-sm text-muted-foreground">
        This image isn&apos;t available right now.
      </span>
    </div>
  );
}

/** Removes the node only. The stored bytes stay so undo restores a working image. */
function DeleteImageButton({ onDelete }: { onDelete: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remove image from note"
      onClick={onDelete}
      className={cn(
        // rounded-md is the app's standard control radius; circular icon buttons are
        // reserved for the avatar.
        "absolute right-2 top-2 rounded-md h-7 w-7 border border-border bg-background/90 text-muted-foreground/70 hover:text-foreground",
        HOVER_REVEAL_CLASS
      )}
    >
      <Trash2 />
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

  useEffect(() => {
    commitRef.current = onCommit;
  });

  // Every write is a replicated Yjs update, so keystrokes are coalesced.
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commitRef.current(draft), ALT_TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value]);

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
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
