"use client";

import { ReactNode } from 'react';
import { AuthStoreProvider } from '@/lib/providers/auth-store-provider';
import { OrganizationStateStoreProvider } from '@/lib/providers/organization-state-store-provider';
import { CoachingRelationshipStateStoreProvider } from '@/lib/providers/coaching-relationship-state-store-provider';
import { CoachingSessionsCardFilterStoreProvider } from '@/lib/providers/coaching-sessions-card-filter-store-provider';
import { UiPreferencesStoreProvider } from '@/lib/providers/ui-preferences-state-store-provider';
import { SessionCleanupProvider } from '@/lib/providers/session-cleanup-provider';
import { SSEProvider } from '@/lib/providers/sse-provider';
import { SWRConfig } from 'swr';
import { useSyncUserSession } from '@/lib/hooks/use-sync-user-session';

interface ProvidersProps {
  children: ReactNode;
}

function UserSessionSync({ children }: { children: ReactNode }) {
  useSyncUserSession();
  return <>{children}</>;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthStoreProvider>
      <OrganizationStateStoreProvider>
        <CoachingRelationshipStateStoreProvider>
          <CoachingSessionsCardFilterStoreProvider>
            <UiPreferencesStoreProvider>
              <SessionCleanupProvider>
                <SWRConfig
                  value={{
                    revalidateIfStale: true,
                    focusThrottleInterval: 10000,
                    provider: () => new Map(),
                  }}
                >
                  <UserSessionSync>
                    <SSEProvider>
                      {children}
                    </SSEProvider>
                  </UserSessionSync>
                </SWRConfig>
              </SessionCleanupProvider>
            </UiPreferencesStoreProvider>
          </CoachingSessionsCardFilterStoreProvider>
        </CoachingRelationshipStateStoreProvider>
      </OrganizationStateStoreProvider>
    </AuthStoreProvider>
  );
}
