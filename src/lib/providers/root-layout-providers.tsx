"use client";

import { ThemeProvider } from "@/components/ui/providers";
import { AuthStoreProvider } from "@/lib/providers/auth-store-provider";
import { SWRConfig } from "swr";
import { OrganizationStateStoreProvider } from "./organization-state-store-provider";
import { SimpleOrganizationStateStoreProvider } from "./simple-organization-state-store-provider";
import { CoachingRelationshipStateStoreProvider } from "./coaching-relationship-state-store-provider";
import { SimpleCoachingRelationshipStateStoreProvider } from "./simple-coaching-relationship-state-store-provider";
import { CoachingSessionStateStoreProvider } from "./coaching-session-state-store-provider";
import { OverarchingGoalStateStoreProvider } from "./overarching-goal-state-store-provider";

export function RootLayoutProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Provides single AuthStore & AppStateStore instances to all child pages/components/functions */}
      <AuthStoreProvider>
        <OrganizationStateStoreProvider>
          <SimpleOrganizationStateStoreProvider>
            <CoachingRelationshipStateStoreProvider>
              <SimpleCoachingRelationshipStateStoreProvider>
                  <CoachingSessionStateStoreProvider>
                    <OverarchingGoalStateStoreProvider>
                      <SWRConfig
                        value={{
                          revalidateIfStale: true,
                          focusThrottleInterval: 10000,
                          provider: () => new Map(),
                        }}
                      >
                        {children}
                      </SWRConfig>
                    </OverarchingGoalStateStoreProvider>
                  </CoachingSessionStateStoreProvider>
                </SimpleCoachingRelationshipStateStoreProvider>
              </CoachingRelationshipStateStoreProvider>
            </SimpleOrganizationStateStoreProvider>
          </OrganizationStateStoreProvider>
      </AuthStoreProvider>
    </ThemeProvider>
  );
}
