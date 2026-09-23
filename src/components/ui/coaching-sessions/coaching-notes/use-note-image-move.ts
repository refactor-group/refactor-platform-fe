import { useEffect, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type Option, Some, None } from "@/types/option";

/** Past this, a press becomes a drag rather than a click. */
const DRAG_THRESHOLD_PX = 5;

/**
 * A top-level block: where it sits in the document, and where it sits on screen.
 *
 * Top-level only. An image is a block node and always lands between blocks, so
 * resolving against the document's own children avoids the ambiguity of
 * `posAtCoords` inside nested content.
 */
interface MeasuredBlock {
  offset: number;
  nodeSize: number;
  rect: DOMRect;
}

/** Where a dragged image would land, and where to draw the line saying so. */
export interface DropTarget {
  pos: number;
  left: number;
  top: number;
  width: number;
}

function measureBlocks(editor: Editor): MeasuredBlock[] {
  const view = editor.view;
  const blocks: MeasuredBlock[] = [];
  view.state.doc.forEach((node: ProseMirrorNode, offset: number) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    blocks.push({ offset, nodeSize: node.nodeSize, rect: dom.getBoundingClientRect() });
  });
  return blocks;
}

/** The block edge nearest the pointer. Pure: layout was read once, up front. */
export function dropTargetAmong(
  blocks: MeasuredBlock[],
  clientY: number
): Option<DropTarget> {
  if (blocks.length === 0) return None;

  const candidates = blocks.map(({ offset, nodeSize, rect }) => {
    const above = clientY < rect.top + rect.height / 2;
    const edge = above ? rect.top : rect.bottom;
    return {
      pos: above ? offset : offset + nodeSize,
      left: rect.left,
      top: edge,
      width: rect.width,
      distance: Math.abs(clientY - edge),
    };
  });

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

/** Move the node at `from` to `target` in one transaction, so it reads as a move. */
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

interface Press {
  x: number;
  y: number;
  pointerId: number;
  moved: boolean;
}

interface Measurement {
  doc: ProseMirrorNode;
  blocks: MeasuredBlock[];
}

export interface NoteImageMoveHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

/**
 * Move an image within its note by dragging it, driven by pointer events.
 *
 * Not HTML5 drag-and-drop: the browser composites a drag preview from whatever is
 * dragged and there is no portable way to suppress it, so nothing here is natively
 * draggable and the drop line is the only thing a drag draws.
 */
export function useNoteImageMove(
  editor: Editor,
  getPos: () => number | undefined,
  surfaceRef: RefObject<HTMLElement | null>
): { dragging: boolean; handlers: NoteImageMoveHandlers } {
  const [dragging, setDragging] = useState(false);
  const press = useRef<Option<Press>>(None);
  const measurement = useRef<Option<Measurement>>(None);
  const lastY = useRef(0);

  // Layout is read once per drag rather than per pointermove, which would force a
  // synchronous layout of every block at pointer-event frequency. It is re-read only
  // when something could have moved the blocks: the document changing underneath (a
  // remote edit), or a scroll.
  const blocks = (): MeasuredBlock[] => {
    const doc = editor.state.doc;
    const current = measurement.current;
    if (current.some && current.val.doc === doc) return current.val.blocks;
    const fresh = measureBlocks(editor);
    measurement.current = Some({ doc, blocks: fresh });
    return fresh;
  };

  const redraw = () => {
    const target = dropTargetAmong(blocks(), lastY.current);
    if (target.some) showDropLine(target.val);
    else hideDropLine();
  };

  // The line is positioned against the viewport, so a scroll mid-drag moves the blocks
  // out from under it. Capture catches the editor's own scroll container as well as
  // the page's.
  useEffect(() => {
    if (!dragging) return;
    const onScroll = () => {
      measurement.current = None;
      redraw();
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
    // redraw only reads refs and the editor, both stable for the drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  useEffect(() => hideDropLine, []);

  const release = (pointerId: number) => {
    const surface = surfaceRef.current;
    // Capture can already be gone by the time the press ends, and releasing a pointer
    // the element no longer holds throws.
    if (surface?.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
  };

  const finish = () => {
    if (press.current.some) release(press.current.val.pointerId);
    press.current = None;
    measurement.current = None;
    hideDropLine();
    setDragging(false);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    // A finger dragging over an image is scrolling the note, and has to stay that way:
    // taking the gesture over would make a note full of images unscrollable on a phone.
    if (event.pointerType === "touch") return;
    // Only the image itself is a drag surface. The controls and the description field
    // keep their own pointer behaviour, including drag-selecting text in the field.
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(".note-image__img, .note-image__unavailable")) return;
    press.current = Some({
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      moved: false,
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!press.current.some) return;
    const state = press.current.val;
    lastY.current = event.clientY;

    if (!state.moved) {
      const travelled = Math.hypot(event.clientX - state.x, event.clientY - state.y);
      if (travelled < DRAG_THRESHOLD_PX) return;
      state.moved = true;
      surfaceRef.current?.setPointerCapture(state.pointerId);
      setDragging(true);
    }

    redraw();
  };

  const onPointerUp = () => {
    if (!press.current.some) return;
    const moved = press.current.val.moved;
    // Resolved against the current document, so a remote edit during the drag cannot
    // leave the target pointing past its end.
    const target = moved ? dropTargetAmong(blocks(), lastY.current) : None;
    finish();

    const from = getPos();
    if (target.some && typeof from === "number") moveNode(editor, from, target.val.pos);
  };

  // Cancel means the interaction was taken away (a scroll began, an OS gesture
  // intervened, the pointer went invalid), not that anything was dropped. Abandon it.
  const onPointerCancel = () => {
    if (!press.current.some) return;
    finish();
  };

  return {
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
