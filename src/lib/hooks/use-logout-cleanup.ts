"use client";

import { useEffect, useRef } from "react";
import { logoutCleanupRegistry } from "@/lib/hooks/logout-cleanup-registry";

/**
 * Registers a cleanup function to be called during logout.
 * Automatically unregisters when the component unmounts.
 *
 * Uses a ref pattern to ensure the cleanup function always has access to
 * the latest values without causing re-registration on every render.
 *
 * @example
 * ```typescript
 * useLogoutCleanup(useCallback(() => {
 *   cleanupProvider();
 *   resetState();
 * }, [dependencies]));
 * ```
 */
export function useLogoutCleanup(cleanup: () => void): void {
  // Use ref to avoid re-registering on every render
  // The ref always points to the latest cleanup function
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    // Wrap the cleanup call to use the ref's current value
    // This ensures we always call the most recent cleanup function
    const wrappedCleanup = () => cleanupRef.current();
    const unregister = logoutCleanupRegistry.register(wrappedCleanup);

    return () => {
      unregister();
    };
  }, []);
}
