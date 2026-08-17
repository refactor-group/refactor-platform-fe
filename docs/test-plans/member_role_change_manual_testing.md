# Test Plan: Manually Testing In-Place Member Role Changes (Frontend)

Companion to the backend plan at
`refactor-platform-rs/docs/test-plans/organization_member_role_change_manual_testing.md`.

**This plan deliberately does not re-run the backend's plan.** Its sections A–K are curl-level
backend properties — authorization refusals, visibility masking, the audit trail, Postgres
concurrency — and several are not observable as UI differences at all. This document covers only
what a browser can see and the backend plan cannot: control visibility, the self-row lockout, the
org-scoped response hazard, rollback, and whether a role change reaches an already-open session.

Last executed **2026-08-17** against backend branch `feat/organization-member-role-endpoints`
(draft PR rs#393) on a real Postgres dev database. Result: **7 of 8 scenarios pass. S6 fails** —
see the finding at the end.

---

## 1. Prerequisites

- Frontend on `http://localhost:3000`, backend on `http://localhost:4000`.
- Backend built from `feat/organization-member-role-endpoints`. Verify with an authenticated
  `GET .../role`: a **405** means the running binary predates the branch, even if the source has it.
- Seeded dev database.

### Actors

Credentials live in `.env.local`. **Never paste them into this document.**

| Variable prefix | Seeded account | Role |
|---|---|---|
| `PW_ORG_ADMIN_LOGIN_*` | jim@refactorgroup.com | Admin of Refactor Group, and its **only** admin |
| `PW_SUPER_ADMIN_LOGIN_*` | admin@refactorcoach.com | global SuperAdmin (`organization_id: null`) |
| `PW_USER_LOGIN_*` | james.hodapp@gmail.com | plain member of **all three** orgs |

Organizations: Refactor Group `617e8b03-…`, Acme Corp `f67343c9-…`, BigTable `9c5cd245-…`.

### S0 — Fixture discovery (run this first, do not assume)

Log in as each actor and record the roles actually returned. Every scenario below depends on there
being a sole-admin org and a multi-org member. Verified 2026-08-17: all three properties hold.

### Helpers

Reuse the backend plan's `login` / `getrole` / `putrole` shell functions verbatim.

> **Harness note for browser automation.** Injecting a session by writing `localStorage` on an
> already-loaded page **does not work** — zustand's persist middleware rehydrates the previous actor
> and writes it back over you. Use Playwright's `addInitScript`, which runs before app JS. This cost
> a false result during the first pass of S4.

---

## 2. Scenarios

### S1 — Control visibility ✅

The role Select is absent for a plain member, present for an org Admin, and present for a
SuperAdmin viewing an org they do not administer.

Observed: as org admin, a `Role for {name}` combobox on every row; values read Admin/Member
correctly; the existing `Roles:` line (which carries Coach/Coachee and SuperAdmin) is preserved
alongside it, not replaced.

### S2 — Self-row lockout ✅

The viewer's own row renders the Select **disabled**, with the title "You can't change your own
role". Disabled rather than hidden, so the viewer still sees their own role.

Observed live. Confirm separately via curl that the endpoint 403s in **both** directions — promote
and demote, even to the role already held. Mirrors backend E4/E9.

### S3 — Promote / demote round trip ✅

Member → Admin returns 200, and the change **survives a full page reload**. Demote restores it.

> **Coverage gap, by design of the control.** Re-selecting the value a member already holds sends
> **no request** — Radix `Select` does not fire `onValueChange` for an unchanged value. The
> backend's idempotent-no-op path (its section C) is therefore unreachable through the UI. Verified:
> three selections produced only two PUTs. Not a defect; test it with curl, not the browser.

### S4 — Last-admin 409, inline ✅

As the **super admin** (the org admin cannot target themselves), demote the org's only admin.

Observed: real 409 from the backend, its message rendered verbatim in a `role="alert"` node on that
row, the Select reverted to "Admin", and — the assertion that matters — **zero toasts**. Mirrors
backend D1.

Key off the `error` slug, never the prose: the wording already changed once.

### S5 — Org-scoped response must not destroy other memberships ✅

**The most important scenario in this document. Do not skip it.**

Change the role of the multi-org member, then log in **as that member** and confirm nothing was
lost.

Observed: the PUT response carried `roles` of length **1** for a user holding **3**. After the
change, a fresh login for that user still returned all three roles, `localStorage["auth-store"]`
held all three, and the org switcher listed Refactor Group, BigTable and Acme Corp. Mirrors
backend B1.

This is the manual counterpart to the SWR cache regression test in
`__tests__/lib/api/organizations/users-update-role.test.ts`.

### S6 — Change takes effect on the demoted user's open session ❌ **FAILS**

Demote a member, then — **without re-login** — check their own already-open session.

Expected: they lose admin affordances on the next navigation.
Observed: they keep the Organization-settings nav, the Add Member button, and all five role
Selects. See the finding below.

### S7 — No remove-then-add, no undo ✅

`updateRole` (PUT) is the only role-change path. `attachExisting` (POST) appears solely in the
add-member dialog as a grant, and `removeFromOrganization` (DELETE) solely in the remove flow.
Nothing sequences them. No undo affordance is offered after a removal — correct, since the backend
recovery path (workstream C) does not exist yet and the POST can 404 for the very admin who removed
the member.

### S8 — 404 → 403 regression ✅

Nothing branches on a 404 from an org-scoped route. The only 404 branches are
`src/app/setup/[token]/page.tsx` (magic-link) and `src/lib/api/oauth-connection.ts` (user-scoped).
Unaffected by the backend's contract §8 change.

---

## 3. Restoring the fixture

Every role touched must be returned to its starting value: Refactor Group has exactly one Admin
(jim@refactorgroup.com); everyone else is User. Verify through
`GET /organizations/{id}/users` before signing off. Confirmed restored on 2026-08-17.

---

## 4. Finding: a role change does not reach an already-open session

**Severity: real, pre-existing, and newly reachable.** Not introduced by the role-change feature,
but that feature creates the first path that triggers it deliberately.

`userSession` — including its `roles` array — is written to the persisted auth store **only by the
`login` action**, which has exactly one call site (`src/components/ui/login/user-auth-form.tsx`).
Nothing else refreshes it; the only other mutator is the field-scoped `setTimezone`. So a user's
roles are frozen at login and survive in `localStorage` across reloads and new browser sessions.

Consequence: after an admin demotes someone, that person's UI keeps offering admin affordances until
they log out and back in. The backend is correct throughout — their next mutation 403s — so this is
a UI-truthfulness problem, not a security hole. But it means the app offers actions it knows will be
refused.

The backend test plan predicted exactly this as FE-side risk case 3 (its I3/I6).

Fixing it is an architectural change beyond the scope of the build that surfaced it: it needs the
session's roles re-read from the server periodically, on navigation, or via SSE. Tracked separately.

Until then, **S6 is a known failure**, and the sign-off checklist below records it as such rather
than quietly passing.

---

## 5. Sign-off checklist

- [x] S0 fixture discovery — sole-admin org and multi-org member both confirmed present
- [x] S1 control visibility
- [x] S2 self-row disabled
- [x] S3 promote/demote round trip, persists across reload
- [x] S4 last-admin 409 inline, no toast, Select reverts
- [x] S5 multi-org memberships intact after a change
- [ ] S6 demoted user's open session — **FAILS, see section 4**
- [x] S7 no remove-then-add, no undo affordance
- [x] S8 no 404-from-org-route branching
- [x] Fixture restored to its starting state
