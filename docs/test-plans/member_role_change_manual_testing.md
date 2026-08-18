# Test Plan: Manually Testing In-Place Member Role Changes (Frontend)

Companion to the backend plan at
`refactor-platform-rs/docs/test-plans/organization_member_role_change_manual_testing.md`.

**This plan deliberately does not re-run the backend's plan.** Its sections A–K are curl-level
backend properties — authorization refusals, visibility masking, the audit trail, Postgres
concurrency — and several are not observable as UI differences at all. This document covers only
what a browser can see and the backend plan cannot: control visibility, the self-row lockout, the
org-scoped response hazard, and whether a role change reaches an already-open session.

Record results wherever the run is being reported (PR, commit body, coordination board). Do not
write them into this file.

---

## 1. Prerequisites

- Frontend on `http://localhost:3000`, backend on `http://localhost:4000`.
- Backend built from a branch containing the member-role endpoints. Verify with an authenticated
  `GET /organizations/{orgId}/users/{userId}/role`: a **405** means the running binary predates the
  branch, even when the source has the route. Rebuild and restart before going further.
- Seeded dev database.

### Actors

Credentials live in `.env.local`. **Never paste them into this document or into a shell that echoes.**

| Variable prefix | Required properties |
|---|---|
| `PW_ORG_ADMIN_LOGIN_*` | Admin of a target org, and its **only** admin |
| `PW_SUPER_ADMIN_LOGIN_*` | global SuperAdmin (`organization_id: null`) |
| `PW_USER_LOGIN_*` | plain member of **at least two** organizations |

### S0 — Fixture discovery (run first, do not assume)

Log in as each actor and record the roles actually returned. Every scenario depends on there being a
sole-admin org and a multi-org member. If the seeded data does not provide both shapes, stop and fix
the fixture — do not work around it.

### Helpers

Reuse the backend plan's `login` / `getrole` / `putrole` shell functions verbatim.

### Harness warnings for browser automation

Three traps, each of which has produced a false result:

1. **Seeding a session by writing `localStorage` on a loaded page does not work.** Zustand's persist
   middleware rehydrates the previous actor and writes it back over you. Use `addInitScript`, which
   runs before app JS.
2. **`addInitScript` re-runs on every navigation.** Guard it with
   `if (!localStorage.getItem('auth-store'))`, or each `goto` will re-seed a stale session and mask
   whatever you are testing.
3. **Do not drive the admin's out-of-band change through Playwright's `page.request`.** It shares the
   browser context's cookie jar and will overwrite the session under test with the admin's, after
   which the self-read 403s and everything looks stale. Use curl for anything the admin does.

---

## 2. The control under test

Each member row carries a `⋯` actions menu labelled `Actions for {first} {last}`. A member's role is
changed by a single item — **"Grant organization admin access"** on a member's row, **"Revoke
organization admin access"** on an admin's. Never both, and never the role already held. Both are
scoped to the organization in wording, so neither is mistaken for global SuperAdmin. A success toast confirms the
change ("{name} is now an organization Admin" / "…is no longer an organization Admin").

The row's `Roles:` line separately carries Coach/Coachee and SuperAdmin. It renders the plain
organization role as **"Member"** — the same word the menu and the add-member dialog use — rather
than the raw `User` enum value.

---

## 3. Scenarios

### S1 — Control visibility

Open the members page as each actor in turn.

Expected: the role item is absent for a plain member, present for an org Admin, and present for a
SuperAdmin viewing an org they do not administer.

The `⋯` menu is gated on the viewer being an org Admin or global SuperAdmin, and the role item
repeats that check locally. The local check is defence in depth and is **not independently
observable** — with the ancestor gate in place, removing it changes nothing a test can see.

### S2 — Self-row lockout

As the org admin, open your own row's menu.

Expected: **neither** role item appears — hidden, not disabled, matching Remove/Delete on your own
row. Nothing is lost, since the `Roles:` line still shows your own role.

Then confirm via curl that the endpoint returns 403 in **both** directions — promote and demote,
even to the role already held. Mirrors backend E4/E9.

### S3 — Promote / demote round trip

As the org admin, promote another member, then demote them back.

Expected: 200 each time, a success toast naming the new role, and the change survives a full page
reload.

> **Inherent coverage gap.** Only the opposite role is ever offered, so the UI cannot request the
> role a member already holds. The backend's idempotent-no-op path (its section C) is unreachable
> through the browser — exercise it with curl.

### S4 — Last-admin refusal, inline

As the **super admin** (the org admin cannot target themselves), demote the org's only admin.

Expected: the backend's 409 message renders in a `role="alert"` node **on that row**, and **no toast
appears**. The message is the backend's own; the FE keys off the `error` slug, never the prose, which
has already changed once. Mirrors backend D1.

### S5 — Org-scoped response must not destroy other memberships

**The most important scenario here. Do not skip it.**

Change the role of the multi-org member, then log in **as that member**.

Expected: they still hold every organization they held before, both in
`localStorage["auth-store"]` and in the org switcher. Verify by reading `localStorage` directly —
eyeballing the switcher is weaker evidence.

The PUT response carries `roles` filtered to the path organization only, so a naive merge of that
payload into a cached user destroys the rest. Mirrors backend B1, and is the manual counterpart to
`__tests__/lib/api/organizations/users-update-role.test.ts`.

### S6 — Change reaches an already-open session

Demote a member, then — **without re-login, reload or navigation** — return to their open tab.

Expected: immediately after the change the tab is still stale; once the tab regains focus the
persisted role updates, admin affordances disappear, and every other organization membership
survives. Mirrors backend I3/I6.

Two limits are by design, not defects:

1. **Focus-bound.** Revalidation happens on tab focus with no polling interval, to avoid background
   request load. A user who never leaves the tab keeps stale affordances until they do. SWR's
   `focusThrottleInterval` is 10s, so repeated focus events inside that window collapse into one —
   wait it out before concluding nothing happened.
2. **Promotion does not heal a page that already denied access.** The members page calls
   `notFound()` during render, which is terminal for that render tree. A user promoted while sitting
   on a denied page sees the session heal underneath them, but the 404 remains until they navigate.
   The demotion direction — the one that matters for not offering actions the backend will refuse —
   updates in place.

### S7 — No remove-then-add, no undo

Expected by inspection: the role PUT is the only role-change path; nothing sequences DELETE then
POST, and no undo affordance is offered after a removal. The backend recovery path does not exist
yet, and a follow-up POST can 404 for the very admin who performed the removal.

### S8 — 404 → 403 regression

Expected: nothing branches on a 404 from an org-scoped route to mean "org not found". Re-check after
any backend change to `OrganizationAdminAccess`.

---

## 4. How the session stays current

`login` delegates to a generalized `syncUserSession` action, and `useSyncUserSession`
(`src/lib/hooks/use-sync-user-session.ts`, mounted in `Providers`) re-reads the signed-in user on tab
focus and re-seeds the session when the roles differ.

**The safety rule any change here must preserve.** The session's `roles` may only be replaced from a
source returning the user's **complete, cross-organization** role set:

| source | roles returned for a multi-org user | safe to seed from |
|---|---|---|
| `POST /login` | all | ✅ |
| `GET /users/{id}` (self) | all | ✅ |
| `GET /organizations/{orgId}/users` | one | ❌ |
| `PUT /organizations/{orgId}/users/{userId}/role` | one | ❌ |

Seeding from either ❌ source silently deletes the user's other memberships **from their own client,
persisted to localStorage**. Two tests guard this:
`__tests__/lib/api/organizations/users-update-role.test.ts` and
`__tests__/hooks/use-sync-user-session.test.tsx`.

`GET /users/{id}` is self-only in practice — an org admin reading another member gets 403 — so it
serves exactly the case it is needed for and no other.

---

## 5. Restoring the fixture

Every role touched must be returned to its starting value: the target org has exactly one Admin, and
everyone else is a User. Verify through `GET /organizations/{id}/users` before signing off.

---

## 6. Sign-off checklist

- [ ] S0 fixture discovery — sole-admin org and multi-org member both present
- [ ] S1 control visibility
- [ ] S2 self-row shows neither item; endpoint 403s both directions
- [ ] S3 promote/demote round trip, toast, persists across reload
- [ ] S4 last-admin refusal inline, no toast
- [ ] S5 multi-org memberships intact after a change
- [ ] S6 demoted user's open session updates on refocus
- [ ] S7 no remove-then-add, no undo affordance
- [ ] S8 no 404-from-org-route branching
- [ ] Fixture restored to its starting state
