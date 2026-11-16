# Test Plan: Colleague Relationships in the UI (Frontend)

Companion to the backend access matrix at
`refactor-platform-rs/docs/test-plans/relationship_access_manual_testing.md` (rs#399 phase 4), its
colleague rows KIND-04, KIND-11 to KIND-18, SES-46, SER-24 to SER-26, TRN-30, TRN-31, JOB-06,
MAIL-15 and SCHED-17 to SCHED-20.

The backend plan records what each route answers for a colleague relationship. This plan records
what each colleague and admin **sees and can use** in the browser. It does not re-run backend-only
checks (psql rows, job claims, `settle` idempotency); status codes are checked here only where the
UI must handle a refusal or send a new field.

Run it through Playwright MCP with real input (clicks and typing, not dispatched events), for the
rs#399 phase 4 verification pass and whenever colleague behavior changes.

Record results wherever the run is reported (PR, commit body, coordination board). Do not write
them into this file.

---

## 1. Prerequisites

- Frontend on `http://localhost:3000`, backend on `http://localhost:4000`, both on the phase 4
  branches.
- **Mock Resend.** Start the backend with `RESEND_BASE_URL` pointing at a local capture server and
  any `RESEND_API_KEY` (the backend ICS plan, "Point the backend at a mock Resend"). Never run
  this plan with the dev `.env`'s real Resend settings: every section sends mail.
- **Fixture:** the backend plan's cast and rows (its sections 2 and 3): O1, O2, `COACH`,
  `COACHEE`, `OTHER_COACH`, `MEMBER`, `ADMIN`, `OUTSIDER`, `SUPER`, `REMOVED`, R1 to R3.
- **Extra for this plan:**
  - `RC`: the colleague relationship of COACH and MEMBER, created through the UI in COL-01.
    MEMBER has no other relationship, so MEMBER is a colleague-only user.
  - Two transcripts for section 3.7: a completed one on an RC session, and one on an R1 session.
  - Timezones and defaults for section 3.8, set as the backend plan's SER-25 and SCHED-17 say:
    COACH in `Asia/Tokyo`, MEMBER in `America/New_York`, different default session lengths.
  - A Google connection for COACH only, for SCHED-18's half of COL-71.
- **Logins** come from `.env.local` (`PW_*_LOGIN_*`) or the backend fixture. Never paste them here.

### Harness warnings

The access plan's warnings apply (`relationship_access_manual_testing.md`, section 1): prove the
response recorder works, log in through the form after the page settles, switch users with
`clearCookies()` plus `localStorage.clear()`, and drive another user's changes with curl.

For the live-update rows, keep the second colleague in a **second browser context**, not curl,
so their view is the one checked.

---

## 2. How to read the tables

- **Viewer** is the logged-in fixture user. COACH and MEMBER are the two colleagues in RC.
- **Expected** describes what is visible or usable. "Hidden" means absent from the DOM.
- **BE** lists the backend rows the control relies on. A UI row passes only if its BE rows hold.
- **No coaching words:** for RC, no visible text calls either colleague "Coach" or "Coachee"
  (labels, headings, sublines, toasts, aria labels). Coaching relationships keep their words.

---

## 3. Matrix

### 3.1 Creating a colleague relationship (`COL-0x`)

From the Members page, member card **⋯ > Pair with…**.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-01 | Pair MEMBER with COACH, role **Colleague** | ADMIN | Request body has `kind: "colleague"`. Success toast names the pair as colleagues. Both member cards list the relationship with no coach or coachee word | KIND-04 |
| COL-02 | Pair COACH with MEMBER, role **Colleague** (the other order) | ADMIN | Succeeds with the same relationship `id` as COL-01; neither card lists a second relationship | KIND-11 |
| COL-03 | Pair COACH with MEMBER as **Coach** or **Coachee**, while RC exists | ADMIN | The picker shows MEMBER as already paired and not pickable. Forcing the POST (stale dialog: open it before COL-01) gets the `pair_already_related` toast; the dialog stays open; nothing new is listed | KIND-13 |
| COL-04 | Pair COACH with COACHEE as **Colleague**, while R1 exists | ADMIN | Same as COL-03, against the coaching relationship | KIND-12 |
| COL-05 | Pair COACHEE with COACH as **Coach** (the other way round from R1) | ADMIN | Allowed, as before phase 4. Delete it afterwards | KIND-14 |

### 3.2 Adding members with a relationship (`COL-1x`)

Header **Add New > Organization member**, and **Add existing member**.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-10 | Add a new member, Relationship **None** | ADMIN | Body has no `relationship`. The member appears with no relationship | ORG-01 |
| COL-11 | Add a new member, Relationship **Coach**, with COACH | ADMIN | Body has `relationship: {with_user_id: COACH, kind: "coaching"}`, no `coach_id`. COACH coaches the new member | ORG-01 |
| COL-12 | Add a new member, Relationship **Colleague**, with COACH | ADMIN | Body has `kind: "colleague"`. The new member and COACH are listed as colleagues | KIND-15 |
| COL-13 | Add a new member as **Colleague** with someone not in O1 (OUTSIDER, through a stale picker or `page.route` rewrite) | ADMIN | The refusal toast shows and the dialog stays open. After a reload, the members list has no user with that email and COACH has no new relationship | KIND-18 |
| COL-14 | Add existing member (a former member with no relationship to COACH), Relationship **Colleague**, with COACH | ADMIN | Body goes to `…/users/{id}/role` with `relationship: {with_user_id, kind: "colleague"}`. Member and colleague relationship both appear | KIND-16 |
| COL-15 | Add existing member REMOVED as **Colleague** with COACH, while R3 exists | ADMIN | The `pair_already_related` toast. After a reload, REMOVED is not listed as a member and has no new relationship | KIND-17 |

### 3.3 Labels (`COL-2x`)

Each row: open the surface as COACH, then MEMBER, and check **No coaching words** for RC. Then
open it for R1 as COACH and COACHEE and check the coaching words are unchanged.

| ID | Surface | Expected for RC | BE |
|---|---|---|---|
| COL-20 | Members page: member card relationship lines, **Pair with…** sublines ("Already …") | Colleague wording | REL-05 |
| COL-21 | New session dialog **Who** list, Actions page relationship filter, join session menu | The other colleague by name, no role word | REL-01 |
| COL-22 | Session page: header, goals card ("{Name}'s active goals" style headings), action assignee picker | Both colleagues offered as assignees, named without a role | ACT-36 |
| COL-23 | Actions page headers and the My/Coachee toggle | MEMBER (colleague-only): no Coachee Actions toggle. COACH: the toggle concerns R1 only | ACT-01 |
| COL-24 | Dashboard upcoming card, no session today | MEMBER: copy doesn't say "Your coach will schedule". Both colleagues get the scheduling button | SES-27 |
| COL-25 | Toasts from COL-01, COL-12, COL-14 and section 3.4 | No coach or coachee word | |

### 3.4 Scheduling between colleagues (`COL-3x`)

Run each row once as COACH and once as MEMBER, with the other colleague's session page or
dashboard open in the second context.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-30 | New session with the other colleague | COACH, MEMBER | Both have the entry points (Add New, Schedule session, Schedule on {day}). It saves and appears for the other without a reload | SES-09 |
| COL-31 | New series with the other colleague | COACH, MEMBER | Saves; the sessions appear for the other live | SER-01 |
| COL-32 | Edit title, reschedule one session (dialog and week grid drag) | COACH, MEMBER | Saves; the other sees the move live | SES-15, SES-19 |
| COL-33 | Reschedule this and following, from a session the other colleague created | COACH, MEMBER | Saves; the other sees the change live | SER-26 |
| COL-34 | Cancel session, cancel series | COACH, MEMBER | Both work for either colleague; the other sees them leave the grid | SES-21, SER-12 |
| COL-35 | Resend invite, resend series invite | COACH, MEMBER | Both offered and succeed | SES-24, SER-14 |

### 3.5 Actions (`COL-4x`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-40 | RC session panel actions | COACH, MEMBER | Each sees every RC action, whoever is assigned | ACT-14 |
| COL-41 | Actions page, Assignment All | MEMBER | Every RC action, including ones assigned to COACH | ACT-02 |
| COL-42 | Actions page, Coachee Actions view (`assignee=coachee`) | COACH | R1 actions only; no RC action; no error toast or denial page | section 4 of the contract |
| COL-43 | `/actions?view=coachee_actions` typed by hand | MEMBER | An empty result, not a 403 or the denial page | section 4 of the contract |

### 3.6 Removed colleague (`COL-5x`)

**Setup:** remove MEMBER's O1 role (`ORG-04`). Restore it after the section.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-50 | New session and new series with MEMBER (stale dialog opened before the removal) | COACH | Refusal toast naming MEMBER: "{Name} is no longer in this organization". Nothing saved, no mail captured | SES-46, SER-24 |
| COL-51 | Same, COACH also an org admin | COACH as admin | The toast offers **Add back**, which opens Add existing member | SES-46 |
| COL-52 | RC card menu after a refresh | COACH | Reschedule and resend not offered; Cancel still works | SES-21 |

### 3.7 Suggested actions (`COL-6x`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-60 | RC session with a completed transcript: suggestions area | COACH, MEMBER | No suggestions; the scan control reports it isn't available (no spinner, no error toast) | TRN-30, TRN-31 |
| COL-61 | R1 session with a completed transcript | COACH | Scan and suggestions work as before | TRN-09 |

### 3.8 Meeting link, time and zone (`COL-7x`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-70 | New RC session, no duration chosen | MEMBER | The default length is MEMBER's, not COACH's | SCHED-17 |
| COL-71 | New RC session with a Meet link | MEMBER (no Google), COACH (connected) | The session gets a link made with COACH's account. With neither connected: no link, no error | SCHED-18 |
| COL-72 | Invite time and zone in the mock Resend payload, and the times shown to each colleague | MEMBER schedules | Invites in `America/New_York`; each colleague's UI shows the time in their own zone | SCHED-20, SER-25 |
| COL-73 | Reschedule a series COACH created | MEMBER | Invites switch to MEMBER's zone | SER-26 |

### 3.9 Emails (`COL-8x`)

Run after the backend's contract section 5 (email variables) lands. Read each message from the
mock Resend capture.

| ID | Trigger | Expected | BE |
|---|---|---|---|
| COL-80 | COL-30, COL-32, COL-34 on RC | Both colleagues get the scheduled, rescheduled and cancelled emails. No body or subject says "coach" or "coachee" | MAIL-01 |
| COL-81 | A reminder sweep for an RC session | Both colleagues get one reminder each, naming the other. A second sweep sends nothing | JOB-06, MAIL-15 |
| COL-82 | The same triggers on R1 | Coaching emails unchanged | KIND-06 |

### 3.10 Regression (`COL-9x`)

| ID | Control | Expected |
|---|---|---|
| COL-90 | `relationship_access_manual_testing.md` rows for COACH and COACHEE (sections 3.1 to 3.8) | Unchanged answers |
| COL-91 | `new_session_dialog_manual_testing.md` with R1 | Unchanged |
