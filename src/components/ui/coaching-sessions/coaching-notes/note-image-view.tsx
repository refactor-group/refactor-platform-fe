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

  return (
    <NodeViewWrapper
      as="div"
      className={cn("note-image group relative my-4 w-fit", selected && "is-selected")}
    >
      {/* next/image cannot serve a cookie-authorized backend redirect. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
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
        "absolute right-2 top-2 rounded-full h-8 w-8 bg-background/80 text-muted-foreground/60 hover:text-foreground",
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
      <DialogContent className="max-w-[90vw] border-0 bg-transparent p-0 shadow-none sm:max-w-[90vw]">
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
