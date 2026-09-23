import { Extension, mergeAttributes } from "@tiptap/core";
import type {
  Editor,
  JSONContent,
  MarkdownParseHelpers,
  MarkdownToken,
} from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import FileHandler from "@tiptap/extension-file-handler";
import type {
  Fragment,
  Node as ProseMirrorNode,
  Slice,
} from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import type { Step } from "@tiptap/pm/transform";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { toast } from "sonner";
import {
  CoachingSessionImageApi,
  UploadFailureKind,
} from "@/lib/api/coaching-session-images";
import {
  acceptImageFile,
  downscaleImage,
  enforceUploadSize,
  ImageRejectionKind,
} from "@/lib/utils/downscale-image";
import { ACCEPTED_IMAGE_MIME_TYPES, isImageId } from "@/types/coaching-session-image";
import type { Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import { NoteImageView } from "./note-image-view";

export const COACHING_NOTE_IMAGE_NAME = "coachingNoteImage";

/** Every image URL this app serves starts with this. */
const OWN_IMAGE_URL_PREFIX = CoachingSessionImageApi.imageUrl("");

export const CoachingNoteImage = Image.extend({
  name: COACHING_NOTE_IMAGE_NAME,

  // No native HTML5 drag. The browser composites a drag preview from the dragged
  // element and there is no reliable way to suppress it across engines, so the node
  // view moves the node with pointer events instead and nothing is ever composited.
  //
  // ProseMirror still marks a *selected* node draggable for the length of a press
  // (MouseDown.mightDrag), so a dragstart does fire when a selected image is dragged.
  // TipTap's NodeView.stopEvent cancels drag events aimed at a non-draggable,
  // selectable node's DOM, and ProseMirror never sees them. That is load-bearing and
  // lives in TipTap rather than here, so the extension tests pin it.
  draggable: false,

  addAttributes() {
    return {
      imageId: {
        default: "",
        // Pasted HTML can carry any data-image-id it likes, and the id ends up in
        // credentialed request paths. Anything that is not a UUID becomes "", which
        // the node already treats as absent.
        parseHTML: (element) => {
          const raw = element.getAttribute("data-image-id");
          return isImageId(raw) ? raw : "";
        },
        renderHTML: (attributes) => ({ "data-image-id": attributes.imageId }),
      },
      alt: { default: "" },
      // Reserved now so adding resize handles later needs no document migration.
      width: { default: null },
      // The session this image belongs to, recorded at upload so a paste can tell an
      // image of this note from one carried over from another. Empty on nodes written
      // before this existed, which are treated as belonging here: they predate any way
      // of copying between notes, and a stricter default would strip existing images.
      coachingSessionId: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-coaching-session-id") ?? "",
        renderHTML: (attributes) => ({
          "data-coaching-session-id": attributes.coachingSessionId,
        }),
      },
      // Intrinsic pixel size, recorded at upload. Lets the node reserve the right box
      // before the bytes arrive, and keep it when they never do. Kept separate from
      // `width` above, which is reserved for a display size the user picks. Null on
      // nodes written before this existed, and whenever the backend could not measure.
      naturalWidth: { default: null },
      naturalHeight: { default: null },
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
    return ReactNodeViewRenderer(NoteImageView, {
      // Moving an image up lets ProseMirror reuse its node view without calling
      // update(), and TipTap checks later selections against the position it cached
      // before the move. The view then deselects itself as soon as it is selected at
      // its new place, hiding the description field. This keeps the cache current.
      trackNodeViewPosition: true,
    });
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
    case UploadFailureKind.NotFound:
      return "That image couldn't be added. Please try again.";
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

type ToastId = string | number;

// Long enough that a quick upload finishes without ever saying anything, short
// enough that a slow one is not silent for long enough to look broken.
const IN_PROGRESS_TOAST_DELAY_MS = 400;

interface DelayedProgressToast {
  report: (fraction: number) => void;
  /** Stop the toast from appearing, and report whether it already did. */
  settle: () => Option<ToastId>;
}

function startDelayedProgressToast(): DelayedProgressToast {
  let shown: Option<ToastId> = None;
  const timer = setTimeout(() => {
    shown = Some(toast.loading("Adding image"));
  }, IN_PROGRESS_TOAST_DELAY_MS);

  return {
    // Addressing an id sonner has never seen would create the toast, defeating the delay.
    report: (fraction) => {
      if (shown.some) toast.loading(progressLabel(fraction), { id: shown.val });
    },
    settle: () => {
      clearTimeout(timer);
      return shown;
    },
  };
}

/**
 * A drop position that survives the upload.
 *
 * The upload resolves seconds to minutes after the drop, and the document moves under it
 * the whole time: the author keeps typing, and the other participant's edits arrive over
 * the wire. A raw number captured at drop time is stale by the time it is used, and
 * `insertContentAt` resolves it against the current document with no clamping, so a
 * document that has since shrunk throws RangeError out of a floating promise: an upload
 * the user has already paid for, lost with no error shown.
 */
interface TrackedPosition {
  /** The drop position, mapped through every step since. */
  current(): number;
  stop(): void;
}

function trackPosition(editor: Editor, pos: number): TrackedPosition {
  let mapped = pos;
  const onTransaction = ({ transaction }: { transaction: Transaction }) => {
    mapped = transaction.mapping.map(mapped);
  };
  editor.on("transaction", onTransaction);
  return {
    // Clamped as well as mapped. Mapping alone is right for every edit ProseMirror
    // reports, but the editor can be torn down and rebuilt around a cached document,
    // and a position from the previous instance has no meaning in the new one.
    current: () => Math.min(Math.max(mapped, 0), editor.state.doc.content.size),
    stop: () => {
      editor.off("transaction", onTransaction);
    },
  };
}

/** Validate, downscale, upload, and insert on success. Never touches the document on failure. */
export async function uploadAndInsertImage(
  editor: Editor,
  file: File,
  context: NoteImageUploadContext,
  insertAt?: number
): Promise<void> {
  const accepted = acceptImageFile(file, context.maxBytes);
  if (accepted.isErr()) {
    toast.error(rejectionMessage(accepted.error));
    return;
  }

  // Tracked from here, before the first await, so no edit can slip past unmapped.
  const tracked =
    insertAt === undefined ? undefined : trackPosition(editor, insertAt);

  // Progress lives in a toast, never in the document: a placeholder node is a real
  // Yjs insert that replicates to the other participant and is stranded in shared
  // state forever if this tab dies mid-upload.
  const progress = startDelayedProgressToast();
  const prepared = await downscaleImage(accepted.value, context.maxBytes);

  // The cap applies to what we would actually send, so it is checked here rather than
  // on the picked file: a photo far over the cap routinely downscales well under it.
  const sized = enforceUploadSize(prepared, context.maxBytes);
  if (sized.isErr()) {
    tracked?.stop();
    const pending = progress.settle();
    toast.error(
      rejectionMessage(sized.error),
      pending.some ? { id: pending.val } : undefined
    );
    return;
  }

  const result = await CoachingSessionImageApi.upload(
    context.coachingSessionId,
    sized.value,
    progress.report
  );
  const progressToast = progress.settle();

  if (result.isErr()) {
    tracked?.stop();
    toast.error(
      uploadFailureMessage(result.error.kind),
      progressToast.some ? { id: progressToast.val } : undefined
    );
    return;
  }

  if (progressToast.some) toast.dismiss(progressToast.val);
  const at = tracked
    ? tracked.current()
    : Math.min(editor.state.selection.to, editor.state.doc.content.size);
  tracked?.stop();
  editor
    .chain()
    .focus()
    .insertContentAt(at, {
      type: COACHING_NOTE_IMAGE_NAME,
      attrs: {
        imageId: result.value.id,
        alt: "",
        coachingSessionId: context.coachingSessionId,
        naturalWidth: result.value.width.some ? result.value.width.val : null,
        naturalHeight: result.value.height.some ? result.value.height.val : null,
      },
    })
    .run();
}

/**
 * Upload several files so they land in the order they were given.
 *
 * Sequential rather than concurrent: every file shares one drop position, so racing them
 * means they arrive in completion order, and the small one the user dropped last lands
 * first. Awaiting each in turn is slower and correct.
 *
 * Nothing here is allowed to reject. Callers are event handlers that cannot await, so an
 * escaping rejection is an unhandled one; `uploadAndInsertImage` reports its own failures
 * as toasts, and anything past that is a bug worth seeing in the console rather than
 * losing silently.
 */
export async function uploadFilesInOrder(
  editor: Editor,
  files: File[],
  context: NoteImageUploadContext,
  pos?: number
): Promise<void> {
  // One anchor for the whole batch, mapped through every insertion including our own. A
  // mapped position moves past content inserted at it, so each image lands after the one
  // before. Handing each file the raw drop position instead put every later image in front.
  const anchor = pos === undefined ? undefined : trackPosition(editor, pos);
  try {
    for (const file of files) {
      try {
        await uploadAndInsertImage(editor, file, context, anchor?.current());
      } catch (error) {
        console.error("Adding an image to the note failed unexpectedly:", error);
        toast.error("That image couldn't be added. Please try again.");
      }
    }
  } finally {
    anchor?.stop();
  }
}

export const createNoteImageFileHandler = (context: NoteImageUploadContext) =>
  FileHandler.configure({
    allowedMimeTypes: [...ACCEPTED_IMAGE_MIME_TYPES],
    onDrop: (editor, files, pos) => {
      void uploadFilesInOrder(editor, files, context, pos);
    },
    onPaste: (editor, files) => {
      void uploadFilesInOrder(editor, files, context);
    },
  });

export const FOREIGN_IMAGE_STRIPPED_MESSAGE =
  "Images pasted from another app weren't included. Paste or drag the image itself to add it.";

export const OTHER_SESSION_IMAGE_STRIPPED_MESSAGE =
  "Images from another session weren't included. Add the image to this session instead.";

export interface SanitizedPaste {
  html: string;
  /** A remote image or inline SVG was removed. */
  stripped: boolean;
  /** An image belonging to a different coaching session was removed. */
  strippedOtherSession: boolean;
}

/**
 * Remove images this app does not serve, plus inline SVG, from pasted HTML.
 *
 * Google Docs HTML carries short-lived, account-scoped hotlinks, so keeping them
 * yields a note that looks fine to the author and is already broken for the coachee.
 * SVG goes because it is executable markup.
 */
export function sanitizePastedHtml(
  html: string,
  ownCoachingSessionId?: Id
): SanitizedPaste {
  if (typeof DOMParser === "undefined")
    return { html, stripped: false, strippedOtherSession: false };

  const parsed = new DOMParser().parseFromString(html, "text/html");
  let stripped = false;
  let strippedOtherSession = false;

  const remove = (element: Element) => {
    const parent = element.parentElement;
    element.remove();
    if (parent) pruneEmptyWrappers(parent);
  };

  const strip = (element: Element) => {
    remove(element);
    stripped = true;
  };

  parsed.body.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src");
    if (src === null || !src.startsWith(OWN_IMAGE_URL_PREFIX)) {
      strip(image);
      return;
    }

    // Our own image, but possibly another note's. The row it names is governed by that
    // session's lifecycle: removing the image there marks the row deleted, and the purge
    // would then destroy bytes this note is still showing. An id we cannot attribute is
    // left alone, since nodes written before the attribute existed carry none.
    const owner = image.getAttribute("data-coaching-session-id");
    if (
      ownCoachingSessionId !== undefined &&
      owner !== null &&
      owner !== "" &&
      owner !== ownCoachingSessionId
    ) {
      remove(image);
      strippedOtherSession = true;
    }
  });

  parsed.body.querySelectorAll("svg").forEach(strip);

  return { html: parsed.body.innerHTML, stripped, strippedOtherSession };
}

// Wrappers a stripped image may leave behind. A table cell or list item is excluded on
// purpose: an empty one still carries meaning, and removing it would deform the table.
const PRUNABLE_WRAPPER_TAGS = new Set(["P", "DIV", "SPAN", "FIGURE", "A"]);

/**
 * Walk up from a stripped image removing wrappers it emptied. Google Docs puts every
 * image in its own paragraph, so without this a doc full of images pastes as a run of
 * blank lines.
 */
function pruneEmptyWrappers(element: Element): void {
  let current: Element | null = element;
  while (
    current !== null &&
    current.parentElement !== null &&
    PRUNABLE_WRAPPER_TAGS.has(current.tagName) &&
    current.children.length === 0 &&
    current.textContent?.trim() === ""
  ) {
    const parent: Element = current.parentElement;
    current.remove();
    current = parent;
  }
}

export const createNoteImagePasteSanitizer = (
  context: NoteImageUploadContext
) =>
  Extension.create({
    name: "noteImagePasteSanitizer",

    // Extension-level rather than a plugin prop: ProseMirror only runs the first
    // plugin that supplies transformPastedHTML, while Tiptap composes this one.
    transformPastedHTML(html: string) {
      const result = sanitizePastedHtml(html, context.coachingSessionId);
      if (result.stripped) toast.info(FOREIGN_IMAGE_STRIPPED_MESSAGE);
      if (result.strippedOtherSession) {
        toast.info(OTHER_SESSION_IMAGE_STRIPPED_MESSAGE);
      }
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

/** Whether a fragment holds an image node at any depth. */
function fragmentHasImage(fragment: Fragment): boolean {
  let found = false;
  fragment.forEach((node) => {
    if (found) return;
    if (node.type.name === COACHING_NOTE_IMAGE_NAME) {
      found = true;
      return;
    }
    if (node.content.size > 0 && fragmentHasImage(node.content)) found = true;
  });
  return found;
}

/**
 * Whether a step could add or remove an image, as opposed to only changing text or marks.
 *
 * Typing is the overwhelming majority of steps and is a `ReplaceStep` with `from === to`
 * whose slice is a character, so the slice is what separates it from an image insertion.
 * Testing `instanceof ReplaceStep` instead would be true for a keystroke and skip nothing.
 *
 * Errs towards walking: a step this cannot introspect, or a replacement over a non-empty
 * range, is treated as though it might have changed an image.
 */
export function stepCanChangeImages(step: Step): boolean {
  const range = step as unknown as { from?: number; to?: number };
  if (typeof range.from !== "number" || typeof range.to !== "number") return true;

  // Replacing a non-empty range can drop an image that was inside it.
  if (range.to > range.from) return true;

  // A pure insertion only matters when an image is what it inserts.
  const slice = (step as unknown as { slice?: Slice }).slice;
  return slice ? fragmentHasImage(slice.content) : true;
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
      // Typing is the overwhelming majority of transactions and can neither remove nor
      // reinstate an image node, so skip the two full-document walks unless a step
      // actually replaced a range. Keeps the cost off the keystroke path as notes grow.
      if (!transaction.steps.some(stepCanChangeImages)) return;

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
