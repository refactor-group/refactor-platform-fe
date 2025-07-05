import { ReactNode } from 'react'
import { AuthStoreProvider } from '@/lib/providers/auth-store-provider'
import { OrganizationStateStoreProvider } from '@/lib/providers/organization-state-store-provider'
import { CoachingRelationshipStateStoreProvider } from '@/lib/providers/coaching-relationship-state-store-provider'

export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <AuthStoreProvider>
      <OrganizationStateStoreProvider>
        <CoachingRelationshipStateStoreProvider>
          {children}
        </CoachingRelationshipStateStoreProvider>
      </OrganizationStateStoreProvider>
    </AuthStoreProvider>
  )
}