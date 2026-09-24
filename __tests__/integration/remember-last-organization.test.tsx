import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'ts-luxon';
import { useStore } from 'zustand';
import { createOrganizationStateStore } from '@/lib/stores/organization-state-store';
import {
  useReconcileCurrentOrganization,
  type OrganizationMembership,
} from '@/lib/hooks/use-reconcile-current-organization';
import type { Id } from '@/types/general';
import type { Organization } from '@/types/organization';

type OrganizationStore = ReturnType<typeof createOrganizationStateStore>;

function organization(id: string, name: string): Organization {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
  };
}

const ACME = organization('org-1', 'Acme Corp');
const BETA = organization('org-2', 'Beta Inc');

const loaded = (organizations: Organization[]): OrganizationMembership => ({
  kind: 'loaded',
  organizations,
});

// Mirrors how the switcher wires the store into the reconciler.
function useSignedInOrganization(
  store: OrganizationStore,
  userId: Id,
  membership: OrganizationMembership
) {
  const currentOrganizationId = useStore(store, (s) => s.currentOrganizationId);
  const setCurrentOrganizationId = useStore(store, (s) => s.setCurrentOrganizationId);
  const lastOrganizationIdByUser = useStore(store, (s) => s.lastOrganizationIdByUser);
  const forgetOrganizationForUser = useStore(store, (s) => s.forgetOrganizationForUser);

  useReconcileCurrentOrganization({
    membership,
    currentOrganizationId,
    setCurrentOrganizationId,
    userId,
    lastOrganizationIdByUser,
    forgetOrganizationForUser,
  });
}

function logIn(store: OrganizationStore, userId: Id, membership: OrganizationMembership) {
  return renderHook(
    ({ userId, membership }) => useSignedInOrganization(store, userId, membership),
    { initialProps: { userId, membership } }
  );
}

function logOut(store: OrganizationStore, session: ReturnType<typeof logIn>) {
  session.unmount();
  act(() => store.getState().resetOrganizationState());
}

describe('Remembering the last organization across logins', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns each user to the organization they last picked', () => {
    let store = createOrganizationStateStore();
    let session = logIn(store, 'user-1', loaded([ACME, BETA]));
    expect(store.getState().currentOrganizationId).toBe('org-1');

    act(() => {
      store.getState().setCurrentOrganizationId('org-2');
      store.getState().rememberOrganizationForUser('user-1', 'org-2');
    });

    logOut(store, session);
    expect(store.getState().currentOrganizationId).toBe('');

    // A fresh store rehydrates from localStorage, as a page reload does.
    store = createOrganizationStateStore();
    session = logIn(store, 'user-1', loaded([ACME, BETA]));
    expect(store.getState().currentOrganizationId).toBe('org-2');

    logOut(store, session);
    session = logIn(store, 'user-2', loaded([ACME, BETA]));
    expect(store.getState().currentOrganizationId).toBe('org-1');

    logOut(store, session);
    session = logIn(store, 'user-1', loaded([ACME]));
    expect(store.getState().currentOrganizationId).toBe('org-1');
    expect(store.getState().lastOrganizationIdByUser).toEqual({});
    session.unmount();
  });
});
