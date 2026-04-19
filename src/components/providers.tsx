"use client";

import { ReactNode } from 'react';
import { AuthStoreProvider } from '@/lib/providers/auth-store-provider';
import { OrganizationStateStoreProvider } from '@/lib/providers/organization-state-store-provider';
import { CoachingRelationshipStateStoreProvider } from '@/lib/providers/coaching-relationship-state-store-provider';
import { CoachingSessionsCardFilterStoreProvider } from '@/lib/providers/coaching-sessions-card-filter-store-provider';
import { SessionCleanupProvider } from '@/lib/providers/session-cleanup-provider';
import { SSEProvider } from '@/lib/providers/sse-provider';
import { SWRConfig } from 'swr';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthStoreProvider>
      <OrganizationStateStoreProvider>
        <CoachingRelationshipStateStoreProvider>
          <CoachingSessionsCardFilterStoreProvider>
            <SessionCleanupProvider>
              <SWRConfig
                value={{
                  revalidateIfStale: true,
                  focusThrottleInterval: 10000,
                  provider: () => new Map(),
                }}
              >
                <SSEProvider>
                  {children}
                </SSEProvider>
              </SWRConfig>
            </SessionCleanupProvider>
          </CoachingSessionsCardFilterStoreProvider>
        </CoachingRelationshipStateStoreProvider>
      </OrganizationStateStoreProvider>
    </AuthStoreProvider>
  );
}
