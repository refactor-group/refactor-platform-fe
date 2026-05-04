"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { buildSearchMatches, type SegmentMatch } from "@/lib/transcript/search-matches";
import type { TranscriptSegment } from "@/types/transcription";

interface UseTranscriptSearchOptions {
  /**
   * Ref to the transcript's scrolling container. The hook scopes
   * `scrollIntoView`-equivalent behavior to this container so the outer
   * page never scrolls in response to search navigation.
   */
  scrollContainerRef: RefObject<HTMLElement | null>;
}

export interface TranscriptSearch {
  query: string;
  setQuery: (next: string) => void;
  clearQuery: () => void;

  totalMatches: number;
  /** Zero-based index of the currently-focused match. */
  activeIndex: number;
  goNext: () => void;
  goPrev: () => void;

  /** Renders a segment's text with `<mark>`-wrapped hits. */
  renderSegmentText: (segmentId: string, text: string) => ReactNode;
}

/**
 * Drives client-side phrase search over a list of segments.
 *
 * External state: `query`, `activeIndex`, and navigation actions.
 * Internal wiring: match index building + active-match scrolling +
 * per-segment render hook for `<mark>`-wrapped highlights.
 */
export function useTranscriptSearch(
  segments: readonly TranscriptSegment[],
  { scrollContainerRef }: UseTranscriptSearchOptions
): TranscriptSearch {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const matchRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Rebuild match index whenever the query or segments change.
  const { matches, bySegmentId } = useMemo(
    () => buildSearchMatches(query, segments),
    [query, segments]
  );
  const totalMatches = matches.length;

  // Reset the active match pointer whenever the result set changes.
  // Note: don't clear matchRefs here — by the time this effect runs, React
  // has already re-registered refs for the new query's <mark> elements via
  // inline ref callbacks. Clearing would wipe those fresh entries and the
  // scroll-to-active effect below wouldn't find anything to scroll to.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, segments]);

  // Scroll the active match into the middle of the scrolling container,
  // without affecting the outer page. `matches` (a memoized array) is in
  // the dep list so this re-fires whenever the result set changes — not
  // only when the active index moves. Otherwise a new query that happens
  // to produce the same totalMatches and same activeIndex (often 0→0)
  // wouldn't trigger a scroll to the new first match.
  useEffect(() => {
    if (matches.length === 0) return;
    const el = matchRefs.current.get(activeIndex);
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offset =
      elRect.top - containerRect.top - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollBy({ top: offset, behavior: "smooth" });
  }, [activeIndex, matches, scrollContainerRef]);

  const goNext = useCallback(() => {
    if (totalMatches === 0) return;
    setActiveIndex((i) => (i + 1) % totalMatches);
  }, [totalMatches]);

  const goPrev = useCallback(() => {
    if (totalMatches === 0) return;
    setActiveIndex((i) => (i - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  const clearQuery = useCallback(() => setQuery(""), []);

  const renderSegmentText = useCallback(
    (segmentId: string, text: string): ReactNode => {
      const segmentMatches = bySegmentId.get(segmentId);
      if (!segmentMatches || segmentMatches.length === 0) return text;
      return renderWithHighlights(text, segmentMatches, activeIndex, (globalIdx, el) => {
        if (el) matchRefs.current.set(globalIdx, el);
        else matchRefs.current.delete(globalIdx);
      });
    },
    [bySegmentId, activeIndex]
  );

  return {
    query,
    setQuery,
    clearQuery,
    totalMatches,
    activeIndex,
    goNext,
    goPrev,
    renderSegmentText,
  };
}

/**
 * Splits `text` at each match's span, wrapping hits in <mark> with a
 * stronger style on the active match. Match elements register their
 * DOM node via `registerRef` so the scroll-into-view effect can find
 * them.
 */
function renderWithHighlights(
  text: string,
  matches: readonly SegmentMatch[],
  activeGlobalIndex: number,
  registerRef: (globalIdx: number, el: HTMLElement | null) => void
): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    const isActive = match.globalIndex === activeGlobalIndex;
    nodes.push(
      <mark
        key={`${match.segmentId}-${match.globalIndex}`}
        ref={(el) => registerRef(match.globalIndex, el)}
        className={markClasses(isActive)}
      >
        {text.slice(match.start, match.end)}
      </mark>
    );
    cursor = match.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function markClasses(isActive: boolean): string {
  return isActive
    ? "rounded-[3px] px-0.5 bg-amber-300 text-black dark:bg-amber-400"
    : "rounded-[3px] px-0.5 bg-yellow-200 text-black dark:bg-yellow-500/40 dark:text-foreground";
}
