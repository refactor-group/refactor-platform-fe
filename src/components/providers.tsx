"use client";

import { ReactNode } from 'react';
import { AuthStoreProvider } from '@/lib/providers/auth-store-provider';
import { OrganizationStateStoreProvider } from '@/lib/providers/organization-state-store-provider';
import { CoachingRelationshipStateStoreProvider } from '@/lib/providers/coaching-relationship-state-store-provider';
import { UiPreferencesStoreProvider } from '@/lib/providers/ui-preferences-state-store-provider';
import { NewSessionDialogStoreProvider } from '@/lib/providers/new-session-dialog-store-provider';
import { NewSessionDialogHost } from '@/components/ui/new-session/new-session-dialog-host';
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
          <UiPreferencesStoreProvider>
            <NewSessionDialogStoreProvider>
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
                      <NewSessionDialogHost />
                    </SSEProvider>
                  </UserSessionSync>
                </SWRConfig>
              </SessionCleanupProvider>
            </NewSessionDialogStoreProvider>
          </UiPreferencesStoreProvider>
        </CoachingRelationshipStateStoreProvider>
      </OrganizationStateStoreProvider>
    </AuthStoreProvider>
  );
}
