"use client";

import { useEffect } from 'react';
import { useLogoutUser } from '@/lib/hooks/use-logout-user';
import { registerSessionCleanup } from './session-guard';

/**
 * SessionCleanupProvider: bridges session guard with React cleanup logic
 * 
 * Responsibilities:
 * - Registers comprehensive logout handler with session guard
 * - Coordinates cleanup across all application state stores
 * - Ensures proper provider hierarchy for cleanup dependencies
 * 
 * Dependencies: Auth, Router, Organization, and CoachingRelationship stores
 */
export function SessionCleanupProvider({ children }: { children: React.ReactNode }) {
  const executeLogout = useLogoutUser();

  useEffect(() => {
    // Register logout handler with session guard for 401 auto-cleanup
    registerSessionCleanup(executeLogout);

    return () => {
      // Reset handler on unmount (provider typically lives app lifetime)
      registerSessionCleanup(async () => {
        console.warn('Session cleanup handler not registered');
      });
    };
  }, [executeLogout]);

  return <>{children}</>;
}