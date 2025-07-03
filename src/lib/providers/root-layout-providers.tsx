"use client";

import { ThemeProvider } from "@/components/ui/providers";
import { AuthStoreProvider } from "@/lib/providers/auth-store-provider";
import { SWRConfig } from "swr";
import { SimpleOrganizationStateStoreProvider } from "./simple-organization-state-store-provider";
import { SimpleCoachingRelationshipStateStoreProvider } from "./simple-coaching-relationship-state-store-provider";

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
        <SimpleOrganizationStateStoreProvider>
          <SimpleCoachingRelationshipStateStoreProvider>
            <SWRConfig
              value={{
                revalidateIfStale: true,
                focusThrottleInterval: 10000,
                provider: () => new Map(),
              }}
            >
              {children}
            </SWRConfig>
          </SimpleCoachingRelationshipStateStoreProvider>
        </SimpleOrganizationStateStoreProvider>
      </AuthStoreProvider>
    </ThemeProvider>
  );
}
