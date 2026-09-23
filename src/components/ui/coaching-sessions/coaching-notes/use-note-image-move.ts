import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type Option, Some, None } from "@/types/option";

/** Past this, a press becomes a drag rather than a click. */
const DRAG_THRESHOLD_PX = 5;

/** How close to a scroll edge a drag has to get before the note starts scrolling. */
const EDGE_ZONE_PX = 48;

/** Scroll speed at the very edge, in pixels per frame. It ramps up from zero across the zone. */
const MAX_EDGE_SCROLL_PX = 18;

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

/** Where the dragged image already sits. Dropping there would move nothing. */
export interface DragSource {
  from: number;
  to: number;
}

/**
 * The block edge nearest the pointer that would actually move the image.
 *
 * The image's own position is excluded. It is both "after the block above" and "before
 * the block below", so four edges resolve to it: the edges either side of the image and
 * the facing edges of its neighbours. Offering any of them drew a line that promised a
 * move and then did nothing, which is exactly what releasing in the gap under an image,
 * or on the top half of the block after it, used to do. Over the image itself there is
 * nowhere to go, so there is no target at all.
 */
export function dropTargetAmong(
  blocks: MeasuredBlock[],
  clientY: number,
  source: DragSource
): Option<DropTarget> {
  const own = blocks.find((block) => block.offset === source.from);
  if (own && clientY >= own.rect.top && clientY <= own.rect.bottom) return None;

  const candidates = blocks
    .flatMap(({ offset, nodeSize, rect }) => [
      { pos: offset, top: rect.top, left: rect.left, width: rect.width },
      { pos: offset + nodeSize, top: rect.bottom, left: rect.left, width: rect.width },
    ])
    .filter((edge) => edge.pos !== source.from && edge.pos !== source.to);
  if (candidates.length === 0) return None;

  const best = candidates.reduce((a, b) =>
    Math.abs(clientY - b.top) < Math.abs(clientY - a.top) ? b : a
  );
  return Some({ pos: best.pos, left: best.left, top: best.top, width: best.width });
}

/**
 * Where a drop right now would land, from the layout as it is right now. Measured fresh
 * each time, so the line and the drop can never disagree with what is on screen: a
 * cached layout went stale whenever anything moved without the document changing, such
 * as a scroll that had not yet delivered its event, or an image finishing loading.
 */
function currentDropTarget(
  editor: Editor,
  getPos: () => number | undefined,
  clientY: number
): Option<DropTarget> {
  const from = getPos();
  if (typeof from !== "number") return None;
  const node = editor.state.doc.nodeAt(from);
  if (!node) return None;
  return dropTargetAmong(measureBlocks(editor), clientY, {
    from,
    to: from + node.nodeSize,
  });
}

/**
 * Pixels to scroll this frame: negative near the top edge, positive near the bottom,
 * zero in between. Faster the deeper into the zone the pointer is, and flat out once it
 * is past the edge, where a held pointer is a clear request to keep going.
 */
export function edgeScrollDelta(clientY: number, top: number, bottom: number): number {
  const intoTop = top + EDGE_ZONE_PX - clientY;
  if (intoTop > 0) return -Math.ceil(Math.min(1, intoTop / EDGE_ZONE_PX) * MAX_EDGE_SCROLL_PX);
  const intoBottom = clientY - (bottom - EDGE_ZONE_PX);
  if (intoBottom > 0) return Math.ceil(Math.min(1, intoBottom / EDGE_ZONE_PX) * MAX_EDGE_SCROLL_PX);
  return 0;
}

/**
 * Everything that could scroll the note, innermost first, ending with the page. The
 * note scrolls inside its own container, but once that runs out the page may still
 * have room.
 */
function scrollContainers(from: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (let node: HTMLElement | null = from; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      found.push(node);
    }
  }
  const page = document.scrollingElement;
  if (page instanceof HTMLElement && !found.includes(page)) found.push(page);
  return found;
}

function canScroll(container: HTMLElement, delta: number): boolean {
  return delta < 0
    ? container.scrollTop > 0
    : container.scrollTop + container.clientHeight < container.scrollHeight - 1;
}

/** The part of the innermost container that is actually on screen. */
function visibleEdges(container: HTMLElement): { top: number; bottom: number } {
  const rect = container.getBoundingClientRect();
  return { top: Math.max(rect.top, 0), bottom: Math.min(rect.bottom, window.innerHeight) };
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

export interface NoteImageMoveHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Move an image within its note by dragging it, driven by pointer events.
 *
 * Not HTML5 drag-and-drop: the browser composites a drag preview from whatever is
 * dragged and there is no portable way to suppress it, so nothing here is natively
 * draggable and the drop line is the only thing a drag draws.
 *
 * Once pressed, the rest of the gesture is followed on the window rather than through
 * pointer capture on the image. A Mac trackpad can report the button released on a
 * move before its pointerup; the browser drops capture on that move, and the pointerup
 * then lands on whatever is under the pointer. Listening on the image missed that
 * release and left the drag stuck with its line showing.
 */
export function useNoteImageMove(
  editor: Editor,
  getPos: () => number | undefined
): { dragging: boolean; handlers: NoteImageMoveHandlers } {
  const [dragging, setDragging] = useState(false);
  const abandon = useRef<Option<() => void>>(None);
  const lastY = useRef(0);

  // Everything visible about a drag happens once per animation frame: scroll if the
  // pointer is at an edge, then measure, then draw the line from that same layout.
  // Pointer events only record where the pointer is. That keeps layout reads to one pass
  // per frame rather than one per pointer event, and means what is drawn always matches
  // the layout it is drawn on.
  useEffect(() => {
    if (!dragging) return;
    const containers = scrollContainers(editor.view.dom as HTMLElement);
    let frame = requestAnimationFrame(function tick() {
      if (containers.length > 0) {
        // Native drag-and-drop scrolls at the edges on its own; pointer events do not,
        // so a drag in a long note could not reach anything out of view.
        const { top, bottom } = visibleEdges(containers[0]);
        const delta = edgeScrollDelta(lastY.current, top, bottom);
        if (delta !== 0) {
          const scroller = containers.find((container) => canScroll(container, delta));
          if (scroller) scroller.scrollTop += delta;
        }
      }
      const target = currentDropTarget(editor, getPos, lastY.current);
      if (target.some) showDropLine(target.val);
      else hideDropLine();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [dragging, editor, getPos]);

  // A node view can be torn down mid-press, by a collaborator's edit for one.
  useEffect(
    () => () => {
      if (abandon.current.some) abandon.current.val();
      hideDropLine();
    },
    []
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    // A finger dragging over an image is scrolling the note, and has to stay that way:
    // taking the gesture over would make a note full of images unscrollable on a phone.
    if (event.pointerType === "touch") return;
    // Only the image itself is a drag surface. The controls and the description field
    // keep their own pointer behaviour, including drag-selecting text in the field.
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(".note-image__img, .note-image__unavailable")) return;
    if (abandon.current.some) abandon.current.val();

    const { pointerId, clientX: startX, clientY: startY } = event;
    let moved = false;
    lastY.current = startY;

    const end = (drop: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      abandon.current = None;
      hideDropLine();
      setDragging(false);
      if (!drop || !moved) return;

      // Fresh, against the document and layout as they are at the moment of release.
      const target = currentDropTarget(editor, getPos, lastY.current);
      const from = getPos();
      if (target.some && typeof from === "number") moveNode(editor, from, target.val.pos);
    };

    function onMove(move: PointerEvent) {
      if (move.pointerId !== pointerId) return;
      lastY.current = move.clientY;
      // The button is already up: this move is the release, and the pointerup may
      // never be seen.
      if (move.buttons === 0) return end(true);
      if (moved) return;
      if (Math.hypot(move.clientX - startX, move.clientY - startY) < DRAG_THRESHOLD_PX) return;
      moved = true;
      setDragging(true);
    }

    function onUp(up: PointerEvent) {
      if (up.pointerId !== pointerId) return;
      lastY.current = up.clientY;
      end(true);
    }

    // Cancel means the interaction was taken away (a scroll began, an OS gesture
    // intervened, the pointer went invalid), not that anything was dropped.
    function onCancel(cancel: PointerEvent) {
      if (cancel.pointerId !== pointerId) return;
      end(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    abandon.current = Some(() => end(false));
  };

  return { dragging, handlers: { onPointerDown } };
}
