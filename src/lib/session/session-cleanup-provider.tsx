"use client";

import { useEffect } from 'react';
import { useLogoutUser } from '@/lib/hooks/use-logout-user';
import { registerSessionCleanup } from './session-guard';

/**
 * Provides session cleanup orchestration throughout the application
 * Connects the session guard with React-based cleanup logic
 * 
 * Must be mounted inside providers that provide:
 * - Auth store access
 * - Router access 
 * - Organization/coaching relationship stores
 */
export function SessionCleanupProvider({ children }: { children: React.ReactNode }) {
  const executeLogout = useLogoutUser();

  useEffect(() => {
    console.warn('🔗 [SESSION-CLEANUP-PROVIDER] Registering session cleanup handler');
    // Register the comprehensive logout handler with session guard
    registerSessionCleanup(executeLogout);

    // Cleanup registration on unmount (though provider typically lives app lifetime)
    return () => {
      console.warn('🔗 [SESSION-CLEANUP-PROVIDER] Unregistering session cleanup handler');
      registerSessionCleanup(async () => {
        console.warn('Session cleanup handler not registered');
      });
    };
  }, [executeLogout]);

  return <>{children}</>;
}