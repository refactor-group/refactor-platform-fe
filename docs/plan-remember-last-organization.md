# Plan: remember each user's last-selected organization

## Problem
The current selection (`organization-state-store`, localStorage) is cleared on
logout so the next person on a shared browser doesn't inherit it. On the next
login the reconciler falls back to `organizations[0]`, so a multi-org user
always lands on their first organization.

## Design
- **Store** (`src/lib/stores/organization-state-store.ts`)
  - New persisted field `lastOrganizationIdByUser: Record<Id, Id>`, default `{}`.
  - New action `rememberOrganizationForUser(userId: Id, organizationId: Id)`.
    Ignores an empty `userId` or `organizationId`; keeps the
    `MAX_REMEMBERED_USERS` (10) most recent users.
  - New action `forgetOrganizationForUser(userId: Id)`.
  - `resetOrganizationState()` resets every field except the map, which
    survives logout. Entries are keyed by user, so nothing crosses users.
  - No persist `version` bump: the new field is filled in by zustand's default
    shallow merge. Bumping without a `migrate` would discard stored state.
- **Hook** (`src/lib/hooks/use-current-organization.ts`) also returns
  `lastOrganizationIdByUser`, `rememberOrganizationForUser` and
  `forgetOrganizationForUser`.
- **Reconciler** (`src/lib/hooks/use-reconcile-current-organization.ts`) takes an
  options object including `userId`, `lastOrganizationIdByUser` and
  `forgetOrganizationForUser`, and looks the user's entry up as an `Option<Id>`.
  The fallback, for both "none selected" and "selection revoked", is the
  remembered id if the user is still a member of it, otherwise
  `organizations[0]?.id ?? ""`. A remembered id missing from a loaded list is
  forgotten.
- **Switcher** (`src/components/ui/organization-switcher.tsx`)
  - Passes the store's map and forget action straight to the reconciler.
  - `handleSelectOrganization` calls `rememberOrganizationForUser(userId, orgId)`
    when a user explicitly picks an org (dropdown and mobile sheet). Automatic
    fallbacks and the members-page URL sync are not remembered.

## Security note
The map holds opaque UUIDs only. The backend authorizes every request from the
session, not from client-supplied ids, and a remembered id is only used if the
fresh membership list still contains it.

## Phases
1. **Tests first** (done, 3baa844e). The overseer writes the assertions and the implementer adds
   them. They must fail against `main` for the right reason.
2. **Implementation** (done, aeb4ff70). Make Phase 1's tests pass without editing them.
   `tsc`, lint and the full vitest suite must be green.

## Follow-ups / known gaps
- None yet.
