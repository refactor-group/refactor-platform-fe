import { Extension, mergeAttributes } from "@tiptap/core";
import type {
  Editor,
  JSONContent,
  MarkdownParseHelpers,
  MarkdownToken,
} from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import FileHandler from "@tiptap/extension-file-handler";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { toast } from "sonner";
import {
  CoachingSessionImageApi,
  UploadFailureKind,
} from "@/lib/api/coaching-session-images";
import {
  downscaleImage,
  ImageRejectionKind,
  validateImageFile,
} from "@/lib/utils/downscale-image";
import { ACCEPTED_IMAGE_MIME_TYPES } from "@/types/coaching-session-image";
import type { Id } from "@/types/general";
import { NoteImageView } from "./note-image-view";

export const COACHING_NOTE_IMAGE_NAME = "coachingNoteImage";

/** Every image URL this app serves starts with this. */
const OWN_IMAGE_URL_PREFIX = CoachingSessionImageApi.imageUrl("");

export const CoachingNoteImage = Image.extend({
  name: COACHING_NOTE_IMAGE_NAME,

  addAttributes() {
    return {
      imageId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-image-id") ?? "",
        renderHTML: (attributes) => ({ "data-image-id": attributes.imageId }),
      },
      alt: { default: "" },
      // Reserved now so adding resize handles later needs no document migration.
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-image-id]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // The document is an opaque Yjs blob that can never be rewritten, so a baked
    // URL would rot across environments. Resolve it at render time instead.
    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        src: CoachingSessionImageApi.imageUrl(String(node.attrs.imageId)),
      }),
    ];
  },

  // Reconstructing a node from arbitrary markdown would let pasted text reference
  // any image id, so an image token degrades to its alt text.
  markdownTokenName: "image",

  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
    helpers.createTextNode(
      typeof (token as { text?: unknown }).text === "string"
        ? (token as { text: string }).text
        : ""
    ),

  renderMarkdown: (node: JSONContent) => {
    const attrs = node.attrs ?? {};
    const alt = typeof attrs.alt === "string" ? attrs.alt : "";
    // Absolute, because markdown leaves the app.
    return `![${alt}](${CoachingSessionImageApi.imageUrl(String(attrs.imageId ?? ""))})`;
  },

  // The markdown input rule assumes a `src` attribute this node does not carry.
  addInputRules() {
    return [];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView);
  },
});

export interface NoteImageUploadContext {
  coachingSessionId: Id;
  maxBytes: number;
}

function rejectionMessage(kind: ImageRejectionKind): string {
  switch (kind) {
    case ImageRejectionKind.UnsupportedType:
      return "That kind of file can't be added to a note.";
    case ImageRejectionKind.TooLarge:
      return "That image is too large to add.";
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled image rejection kind: ${_exhaustive}`);
    }
  }
}

function uploadFailureMessage(kind: UploadFailureKind): string {
  switch (kind) {
    case UploadFailureKind.TooLarge:
      return "That image is too large to add.";
    case UploadFailureKind.UnsupportedType:
      return "That kind of file can't be added to a note.";
    case UploadFailureKind.StorageUnavailable:
      return "Images can't be added right now. Please try again later.";
    case UploadFailureKind.Forbidden:
      return "You don't have permission to add images to this session.";
    case UploadFailureKind.Network:
      return "That image couldn't be uploaded. Check your connection and try again.";
    case UploadFailureKind.Unknown:
      return "That image couldn't be added. Please try again.";
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled upload failure kind: ${_exhaustive}`);
    }
  }
}

function progressLabel(fraction: number): string {
  const percent = Math.min(99, Math.round(fraction * 100));
  return `Adding image, ${percent}%`;
}

/** Validate, downscale, upload, and insert on success. Never touches the document on failure. */
export async function uploadAndInsertImage(
  editor: Editor,
  file: File,
  context: NoteImageUploadContext,
  insertAt?: number
): Promise<void> {
  const validated = validateImageFile(file, context.maxBytes);
  if (validated.isErr()) {
    toast.error(rejectionMessage(validated.error));
    return;
  }

  // Progress lives in a toast, never in the document: a placeholder node is a real
  // Yjs insert that replicates to the other participant and is stranded in shared
  // state forever if this tab dies mid-upload.
  const toastId = toast.loading("Adding image");
  const prepared = await downscaleImage(validated.value);
  const result = await CoachingSessionImageApi.upload(
    context.coachingSessionId,
    prepared,
    (fraction) => toast.loading(progressLabel(fraction), { id: toastId })
  );

  if (result.isErr()) {
    toast.error(uploadFailureMessage(result.error.kind), { id: toastId });
    return;
  }

  toast.success("Image added.", { id: toastId });
  editor
    .chain()
    .focus()
    .insertContentAt(insertAt ?? editor.state.selection.to, {
      type: COACHING_NOTE_IMAGE_NAME,
      attrs: { imageId: result.value.id, alt: "" },
    })
    .run();
}

export const createNoteImageFileHandler = (context: NoteImageUploadContext) =>
  FileHandler.configure({
    allowedMimeTypes: [...ACCEPTED_IMAGE_MIME_TYPES],
    onDrop: (editor, files, pos) => {
      files.forEach((file) => {
        void uploadAndInsertImage(editor, file, context, pos);
      });
    },
    onPaste: (editor, files) => {
      files.forEach((file) => {
        void uploadAndInsertImage(editor, file, context);
      });
    },
  });

export const FOREIGN_IMAGE_STRIPPED_MESSAGE =
  "Images pasted from another app weren't included. Paste or drag the image itself to add it.";

export interface SanitizedPaste {
  html: string;
  stripped: boolean;
}

/**
 * Remove images this app does not serve, plus inline SVG, from pasted HTML.
 *
 * Google Docs HTML carries short-lived, account-scoped hotlinks, so keeping them
 * yields a note that looks fine to the author and is already broken for the coachee.
 * SVG goes because it is executable markup.
 */
export function sanitizePastedHtml(html: string): SanitizedPaste {
  if (typeof DOMParser === "undefined") return { html, stripped: false };

  const parsed = new DOMParser().parseFromString(html, "text/html");
  let stripped = false;

  parsed.body.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src");
    if (src !== null && src.startsWith(OWN_IMAGE_URL_PREFIX)) return;
    image.remove();
    stripped = true;
  });

  parsed.body.querySelectorAll("svg").forEach((svg) => {
    svg.remove();
    stripped = true;
  });

  return { html: parsed.body.innerHTML, stripped };
}

export const NoteImagePasteSanitizer = Extension.create({
  name: "noteImagePasteSanitizer",

  // Extension-level rather than a plugin prop: ProseMirror only runs the first
  // plugin that supplies transformPastedHTML, while Tiptap composes this one.
  transformPastedHTML(html: string) {
    const result = sanitizePastedHtml(html);
    if (result.stripped) toast.info(FOREIGN_IMAGE_STRIPPED_MESSAGE);
    return result.html;
  },
});

function imageIdsIn(doc: ProseMirrorNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    if (node.type.name !== COACHING_NOTE_IMAGE_NAME) return true;
    const imageId = String(node.attrs.imageId ?? "");
    if (imageId) ids.add(imageId);
    return false;
  });
  return ids;
}

interface YSyncMeta {
  isChangeOrigin?: boolean;
  isUndoRedoOperation?: boolean;
}

// The key must come from @tiptap/y-tiptap, the fork the collaboration extension
// actually installs: y-prosemirror's own key is a different plugin key entirely.
function isRemote(transaction: Transaction): boolean {
  const meta = transaction.getMeta(ySyncPluginKey) as YSyncMeta | undefined;
  // A local undo is replayed through the same y-sync path, so the undo flag is
  // what separates our own Cmd-Z from the other participant's edit.
  return meta?.isChangeOrigin === true && meta.isUndoRedoOperation !== true;
}

/**
 * Report images that leave the note, and undo, to the backend.
 *
 * Diffing the transaction rather than watching the node view is deliberate: the
 * hover control is only one of several ways a node disappears. Signals are
 * best-effort, so a failure is swallowed rather than interrupting the author.
 */
export const NoteImageRemovalSignal = Extension.create({
  name: "noteImageRemovalSignal",

  addProseMirrorPlugins() {
    // Only ids this editor already reported as removed may be restored.
    // Otherwise a fresh upload, or the images present at initial load, would
    // read as appearances and fire a restore against a live row.
    const signalledRemoved = new Set<string>();

    const signal = (transaction: Transaction) => {
      if (!transaction.docChanged || isRemote(transaction)) return;

      const before = imageIdsIn(transaction.before);
      const after = imageIdsIn(transaction.doc);

      before.forEach((imageId) => {
        if (after.has(imageId)) return;
        signalledRemoved.add(imageId);
        void CoachingSessionImageApi.markDeleted(imageId);
      });

      after.forEach((imageId) => {
        if (before.has(imageId) || !signalledRemoved.has(imageId)) return;
        signalledRemoved.delete(imageId);
        void CoachingSessionImageApi.restore(imageId);
      });
    };

    return [
      new Plugin({
        key: new PluginKey("noteImageRemovalSignal"),
        appendTransaction: (transactions) => {
          transactions.forEach(signal);
          return undefined;
        },
      }),
    ];
  },
});
