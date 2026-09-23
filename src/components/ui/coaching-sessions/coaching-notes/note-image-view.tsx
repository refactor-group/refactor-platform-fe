"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
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
import { useNoteImageMove } from "./use-note-image-move";
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
  const { dragging, handlers } = useNoteImageMove(editor, getPos);

  return (
    <NodeViewWrapper
      as="div"
      {...handlers}
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
      {/* A failed image is removed, not hidden: the editor's own img rule would keep it
          on screen, holding its reserved box above the placeholder. */}
      {loadState.kind === "error" ? (
        <NoteImageUnavailable style={box} />
      ) : (
        // next/image cannot serve a cookie-authorized backend redirect.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={naturalWidth.some ? naturalWidth.val : undefined}
          height={naturalHeight.some ? naturalHeight.val : undefined}
          // Native image dragging would reintroduce the browser's own preview.
          draggable={false}
          className={cn("note-image__img", dragging ? "cursor-grabbing" : "cursor-grab")}
          onLoad={() => setLoadState({ kind: "loaded" })}
          onError={() => setLoadState({ kind: "error" })}
        />
      )}
      <ImageControls
        onOpenFullSize={() => setLightboxOpen(true)}
        onDelete={() => {
          deleteNode();
          // The control leaves with the image, and focus would fall to the page, where
          // Cmd-Z undoes nothing. Keep it in the note.
          editor.commands.focus(undefined, { scrollIntoView: false });
        }}
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
  icon: ReactNode;
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

/**
 * Where the description field stands relative to the document.
 *
 * - idle: showing the document's value, which a collaborator can change underneath it.
 *   Nothing is ever written from here: the field holds no edit of its own.
 * - typing: showing local text that has not been written yet.
 * - committed: written, and still showing that text until the document moves off `over`,
 *   the value it held at the time. TipTap delivers the new value a render later, and
 *   waiting avoids a frame of the old text in between.
 */
type AltTextEdit =
  | { kind: "idle" }
  | { kind: "typing"; text: string }
  | { kind: "committed"; text: string; over: string };

function AltTextField({ value, onCommit }: AltTextFieldProps) {
  const [edit, setEdit] = useState<AltTextEdit>({ kind: "idle" });
  const commitRef = useRef(onCommit);
  const latest = useRef({ edit, value });

  useEffect(() => {
    commitRef.current = onCommit;
    latest.current = { edit, value };
  });

  // Our write has landed, or a collaborator's has replaced it. Either way the document
  // is the truth again.
  if (edit.kind === "committed" && value !== edit.over) setEdit({ kind: "idle" });

  const write = useCallback((text: string, over: string) => {
    if (text === over) {
      setEdit({ kind: "idle" });
      return;
    }
    commitRef.current(text);
    setEdit({ kind: "committed", text, over });
  }, []);

  // Every write is a replicated Yjs update, so keystrokes are coalesced.
  useEffect(() => {
    if (edit.kind !== "typing") return;
    const timer = setTimeout(() => write(edit.text, value), ALT_TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [edit, value, write]);

  // This field only exists while the node is selected, so clicking away unmounts it and
  // the cleanup above cancels a write that has not fired yet. Without this, typing a
  // description and immediately clicking elsewhere loses it silently, having shown the
  // user their own text in the field the whole time.
  useEffect(
    () => () => {
      const { edit: last, value: current } = latest.current;
      if (last.kind === "typing" && last.text !== current) commitRef.current(last.text);
    },
    []
  );

  return (
    <Input
      value={edit.kind === "idle" ? value : edit.text}
      onChange={(event) => setEdit({ kind: "typing", text: event.target.value })}
      onBlur={() => {
        if (edit.kind === "typing") write(edit.text, value);
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
