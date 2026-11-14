"use client";

// Search API — GET /search, keyword mode. Cursor pagination means results
// accumulate across pages, so this module owns its own state machine
// rather than going through SWR's single-key cache.

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { ResultAsync } from "neverthrow";
import { siteConfig } from "@/site.config";
import { logoutCleanupRegistry } from "@/lib/hooks/logout-cleanup-registry";
import { EntityApi, EntityApiError } from "./entity-api";
import {
  SearchErrorCode,
  isSearchableQuery,
  parseSearchResponse,
  SEARCH_MAX_QUERY_LENGTH,
  type SearchError,
  type SearchHit,
  type SearchParams,
  type SearchResponse,
} from "@/types/search";
import { type Option, Some, None } from "@/types/option";

const SEARCH_BASEURL: string = `${siteConfig.env.backendServiceURL}/search`;

/** Matches the backend's sizing guidance for its per-IP rate limit. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Serializes params to the wire format; drops undefined fields. */
export function buildSearchQuery(params: SearchParams): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("q", params.q.slice(0, SEARCH_MAX_QUERY_LENGTH));
  if (params.types !== undefined && params.types.length > 0) {
    qs.set("types", params.types.join(","));
  }
  const scalar: Array<[string, string | number | undefined]> = [
    ["organization_id", params.organization_id],
    ["coaching_relationship_id", params.coaching_relationship_id],
    ["user_id", params.user_id],
    ["coaching_session_id", params.coaching_session_id],
    ["goal_id", params.goal_id],
    ["goal_filter", params.goal_filter],
    ["status", params.status],
    ["topic_status", params.topic_status],
    ["created_from", params.created_from],
    ["created_to", params.created_to],
    ["updated_from", params.updated_from],
    ["updated_to", params.updated_to],
    ["tz", params.tz],
    ["limit", params.limit],
    ["cursor", params.cursor],
    ["mode", params.mode],
  ];
  for (const [key, value] of scalar) {
    if (value !== undefined) qs.set(key, String(value));
  }
  return qs;
}

const ERROR_CODES = Object.values(SearchErrorCode);

/** Maps a thrown fetch error onto the typed SearchError union. */
export function toSearchError(error: unknown): SearchError {
  if (!(error instanceof EntityApiError)) {
    return {
      kind: "unknown",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (error.isNetworkError()) return { kind: "network" };
  if (error.status === 429) return { kind: "rate_limited" };
  if (error.status === 503) return { kind: "unavailable" };
  if (error.status === 400) {
    const body = error.data as { error?: unknown; message?: unknown } | undefined;
    const code = body?.error;
    if (ERROR_CODES.includes(code as SearchErrorCode)) {
      return {
        kind: "validation",
        code: code as SearchErrorCode,
        message: typeof body?.message === "string" ? body.message : error.message,
      };
    }
  }
  return { kind: "unknown", message: error.message };
}

/** True when the failure is an aborted request rather than a real error. */
export function isCancelled(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  return error instanceof EntityApiError && axios.isCancel(error.originalError);
}

export const SearchApi = {
  /**
   * Runs one search page. Pass `signal` to cancel superseded requests; a
   * cancelled call rejects with an error `isCancelled` recognises.
   */
  search: (
    params: SearchParams,
    signal?: AbortSignal
  ): ResultAsync<SearchResponse, SearchError> =>
    ResultAsync.fromPromise(
      EntityApi.getFn<unknown>(
        `${SEARCH_BASEURL}?${buildSearchQuery(params).toString()}`,
        { signal }
      ).then(parseSearchResponse),
      toSearchError
    ),
};

/** Filters applied to every page of a search; excludes `q`, `cursor`, `limit`. */
export type SearchFilters = Omit<SearchParams, "q" | "cursor">;

export type SearchState =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | {
      kind: "loaded";
      query: string;
      hits: SearchHit[];
      nextCursor: Option<string>;
      isLoadingMore: boolean;
      /** Why the last "load more" failed; loaded hits and the cursor stay intact for a retry. */
      loadMoreError: Option<SearchError>;
    }
  | { kind: "error"; query: string; error: SearchError };

export interface UseSearchResult {
  state: SearchState;
  /** Fetches the next page and appends it, retrying a failed one; no-op unless a `next_cursor` is pending. */
  loadMore: () => void;
}

type LoadedSearch = Extract<SearchState, { kind: "loaded" }>;

interface SettledSearch {
  query: string;
  filtersKey: string;
  state: Extract<SearchState, { kind: "loaded" | "error" }>;
}

// ─── Result cache ────────────────────────────────────────────────────
// /search is rate-limited per IP, so a retyped query must not cost a request.

/** After this, a repeated query refetches so edits made elsewhere show up. */
export const SEARCH_CACHE_TTL_MS = 30_000;
const SEARCH_CACHE_MAX_ENTRIES = 50;

interface CacheEntry {
  state: LoadedSearch;
  storedAt: number;
}

// Insertion order doubles as recency: a read re-inserts, so the first key is the stalest.
const resultCache = new Map<string, CacheEntry>();

const cacheKey = (q: string, filtersKey: string): string => `${filtersKey}\u0000${q}`;

function readCache(key: string): Option<LoadedSearch> {
  const entry = resultCache.get(key);
  if (entry === undefined) return None;
  if (Date.now() - entry.storedAt > SEARCH_CACHE_TTL_MS) {
    resultCache.delete(key);
    return None;
  }
  resultCache.delete(key);
  resultCache.set(key, entry);
  return Some(entry.state);
}

function writeCache(key: string, state: LoadedSearch): void {
  resultCache.delete(key);
  resultCache.set(key, {
    // A hit must never resurrect a spinner or a stale "Try again".
    state: { ...state, isLoadingMore: false, loadMoreError: None },
    storedAt: Date.now(),
  });
  if (resultCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const stalest = resultCache.keys().next();
    if (!stalest.done) resultCache.delete(stalest.value);
  }
}

/** Forgets every cached result; runs on logout so results never cross sessions. */
export function clearSearchCache(): void {
  resultCache.clear();
}

logoutCleanupRegistry.register(clearSearchCache);

/**
 * Debounced, cancellable keyword search. Any change to `query` or `filters`
 * resets to page one; `loadMore` appends the next keyset page. Queries the
 * backend would reject as too short resolve to `idle` without a request, and
 * a query answered within the last `SEARCH_CACHE_TTL_MS` resolves from the
 * cache without the debounce or a request.
 */
export function useSearch(
  query: string,
  filters: SearchFilters = {},
  debounceMs: number = SEARCH_DEBOUNCE_MS
): UseSearchResult {
  // Loading and idle are derived, so a keystroke never needs an effect to flip state.
  const [result, setResult] = useState<Option<SettledSearch>>(None);
  const controllerRef = useRef<AbortController | null>(null);
  // Serialized so an identical object literal on every render isn't a change.
  const filtersKey = JSON.stringify(filters);
  // Requests fire from timers and callbacks, which read the latest filters here.
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  });

  const runPage = useCallback(
    (q: string, key: string, cursor: Option<string>, previousHits: SearchHit[]) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const params: SearchParams = {
        ...filtersRef.current,
        q,
        ...(cursor.some ? { cursor: cursor.val } : {}),
      };

      SearchApi.search(params, controller.signal).match(
        (response) => {
          if (controller.signal.aborted) return;
          const loaded: LoadedSearch = {
            kind: "loaded",
            query: q,
            hits: [...previousHits, ...response.hits],
            nextCursor: response.next_cursor,
            isLoadingMore: false,
            loadMoreError: None,
          };
          writeCache(cacheKey(q, key), loaded);
          setResult(Some({ query: q, filtersKey: key, state: loaded }));
        },
        (error) => {
          if (controller.signal.aborted) return;
          // A failed later page keeps what was loaded and the cursor for a retry.
          const state: SettledSearch["state"] = cursor.some
            ? {
                kind: "loaded",
                query: q,
                hits: previousHits,
                nextCursor: cursor,
                isLoadingMore: false,
                loadMoreError: Some(error),
              }
            : { kind: "error", query: q, error };
          setResult(Some({ query: q, filtersKey: key, state }));
        }
      );
    },
    []
  );

  const searchable = isSearchableQuery(query);
  const isCurrent =
    result.some && result.val.query === query && result.val.filtersKey === filtersKey;
  const cached = searchable && !isCurrent ? readCache(cacheKey(query, filtersKey)) : None;

  useEffect(() => {
    if (!searchable) {
      controllerRef.current?.abort();
      return;
    }
    // Not a dependency: a later page making the hook's own result current must not refire this.
    if (readCache(cacheKey(query, filtersKey)).some) return;
    // Sent untrimmed: a trailing space is the backend's opt-out of prefix matching.
    const timer = setTimeout(() => runPage(query, filtersKey, None, []), debounceMs);
    return () => clearTimeout(timer);
  }, [searchable, query, filtersKey, debounceMs, runPage]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const state: SearchState = !searchable
    ? { kind: "idle" }
    : isCurrent
      ? result.val.state
      : cached.some
        ? cached.val
        : { kind: "loading", query };

  const loadMore = () => {
    if (state.kind !== "loaded" || state.isLoadingMore || state.nextCursor.none) return;
    setResult(
      Some({ query, filtersKey, state: { ...state, isLoadingMore: true, loadMoreError: None } })
    );
    runPage(query, filtersKey, Some(state.nextCursor.val), state.hits);
  };

  return { state, loadMore };
}
