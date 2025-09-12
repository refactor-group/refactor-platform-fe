"use client";

import { ReactNode } from 'react';
import { AuthStoreProvider } from '@/lib/providers/auth-store-provider';
import { OrganizationStateStoreProvider } from '@/lib/providers/organization-state-store-provider';
import { CoachingRelationshipStateStoreProvider } from '@/lib/providers/coaching-relationship-state-store-provider';
import { SessionCleanupProvider } from '@/lib/providers/session-cleanup-provider';
import { SWRConfig } from 'swr';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthStoreProvider>
      <OrganizationStateStoreProvider>
        <CoachingRelationshipStateStoreProvider>
          <SessionCleanupProvider>
            <SWRConfig
              value={{
                revalidateIfStale: true,
                focusThrottleInterval: 10000,
                provider: () => new Map(),
              }}
            >
              {children}
            </SWRConfig>
          </SessionCleanupProvider>
        </CoachingRelationshipStateStoreProvider>
      </OrganizationStateStoreProvider>
    </AuthStoreProvider>
  );
}