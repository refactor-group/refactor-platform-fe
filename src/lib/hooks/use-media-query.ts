"use client";

import { useCallback, useSyncExternalStore } from "react";
import { type Option, None, Some } from "@/types/option";

// Shared instances keep the snapshot stable for useSyncExternalStore.
const MATCHES = Some(true);
const MISSES = Some(false);

/** Whether the query matches; None until the browser can answer. */
export function useMediaQuery(query: string): Option<boolean> {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  const getSnapshot = () => (window.matchMedia(query).matches ? MATCHES : MISSES);
  return useSyncExternalStore<Option<boolean>>(subscribe, getSnapshot, () => None);
}
