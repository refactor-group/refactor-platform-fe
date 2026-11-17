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

- Frontend on `http://localhost:3000` with fe#559 and fe#561; backend on `http://localhost:4000` on
  the phase 4 branch, including handoff 4-6 (contract `ColleagueRelationshipsPhase4` v5:
  `viewer`, `scheduling_blocked_by`, `suggests_actions` on every relationship). Without them the FE
  hides every scheduling control, so check one relationship response for `viewer` first.
- **Mock Resend.** Start the backend with `RESEND_BASE_URL` pointing at a local capture server and
  any `RESEND_API_KEY` (the backend ICS plan, "Point the backend at a mock Resend"). Never run
  this plan with the dev `.env`'s real Resend settings: every section sends mail.
- **Fixture:** the backend plan's cast and rows (its sections 2 and 3): O1, O2, `COACH`,
  `COACHEE`, `OTHER_COACH`, `MEMBER`, `ADMIN`, `OUTSIDER`, `SUPER`, `REMOVED`, R1 to R3.
- **Extra for this plan:**
  - `RC`: the colleague relationship of COACH and MEMBER, created through the UI in COL-01.
    MEMBER has no other relationship, so MEMBER is a colleague-only user.
  - `KID` and `RC2`: add KID with Relationship Coachee, coached by COACH; then pair KID and
    OTHER_COACH as colleagues (`RC2`). KID is coached in one relationship and a colleague in
    another, for section 3.4a. (COACHEE can't be used: R2 already makes OTHER_COACH their coach.)
  - Two transcripts for section 3.7: a completed one on an RC session, and one on an R1 session.
  - Timezones and defaults for section 3.8, set as the backend plan's SER-25 and SCHED-17 say:
    COACH in `Asia/Tokyo`, MEMBER in `America/New_York`, different default session lengths.
  - A Google connection for COACH only, for SCHED-18's half of COL-71.
- **Logins** come from `.env.local` (`PW_*_LOGIN_*`) or the backend fixture. Never paste them here.

### Harness warnings

The access plan's warnings apply (`relationship_access_manual_testing.md`, section 1): prove the
response recorder works, log in through the form after the page settles, switch users with
`clearCookies()` plus `localStorage.clear()`, and drive another user's changes with curl.

Keep the second colleague in a **second browser context**, not curl, so their view is the one
checked. Session and series changes reach the other person on their next read (page or grid
change, refresh), as for coaching: there are no live session events. Title, topic and action
changes arrive live.

---

## 2. How to read the tables

- **Viewer** is the logged-in fixture user. COACH and MEMBER are the two colleagues in RC.
- **Expected** describes what is visible or usable. "Hidden" means absent from the DOM.
- **BE** lists the backend rows the control relies on. A UI row passes only if its BE rows hold.
- **No coaching words:** for RC, no visible text calls either colleague "Coach" or "Coachee"
  (labels, headings, sublines, toasts, aria labels). Coaching relationships keep their words.
- **The backend decides:** what each viewer may do comes from the relationship's `viewer`
  (`role`, `can_schedule_sessions`, `sees_all_actions`), `scheduling_blocked_by` and
  `suggests_actions`. A UI row that disagrees with those fields is an FE bug; one that agrees but
  is wrong is a backend bug. Note which when reporting.

---

## 3. Matrix

### 3.1 Creating a colleague relationship (`COL-0x`)

From the Members page, member card **⋯ > Pair with…**.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-01 | Pair MEMBER with COACH, role **Colleague** | ADMIN | The person step reads "Choose Member's colleague". Request body has `kind: "colleague"`. Toast "{Member} and {Coach} are now colleagues". Both member cards show Colleague in Roles and a "Colleagues:" line naming the other; neither lists the other under "Coaches:" | KIND-04 |
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
| COL-20 | Members page: Roles line, "Colleagues:" line, **Pair with…** sublines ("Already Member's colleague") | Colleague wording; "Coaches:" never lists a colleague | REL-05 |
| COL-21 | New session dialog **Who** list, week filter (group "Active"), join session menu | The other colleague by name, no role word | REL-01 |
| COL-22 | Actions page relationship filter and kanban card header | "You and {Other}" for RC; "You → {Coachee}" for R1 | ACT-08 |
| COL-23 | Session page: header presence slots, goals card heading, action assignee picker | Goals heading "Active goals with {Other}"; both colleagues offered as assignees, named without a role | ACT-36 |
| COL-24 | Actions page My/Coachee toggle | MEMBER (colleague-only, not a coach): no toggle. COACH: shown, as a coach of R1 | ACT-01 |
| COL-25 | Dashboard upcoming card, no session today | MEMBER: the scheduling button, not "Your coach will schedule" | SES-27 |
| COL-26 | Cancel and remove toasts, Pair with… and Add member toasts | Name the other person; no coach or coachee word | |
| COL-27 | Open an RC session URL as ADMIN (not a participant) | Denial copy names no role ("Only the people meeting in it can view this session.") | SES-05 |

### 3.4 Scheduling between colleagues (`COL-3x`)

Run each row once as COACH and once as MEMBER, with the other colleague's session page or
dashboard open in the second context.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-30 | New session with the other colleague | COACH, MEMBER | Both have the entry points (Add New, Schedule session, Schedule on {day}); Who lists the other colleague. It saves, and the other sees it after a refresh | SES-09 |
| COL-31 | New series with the other colleague | COACH, MEMBER | Saves; the other sees the sessions after a refresh | SER-01 |
| COL-32 | Edit title, reschedule one session (dialog and week grid drag) | COACH, MEMBER | Saves. The title reaches the other live; the move after a refresh | SES-15, SES-19 |
| COL-33 | Reschedule this and following, from a session the other colleague created | COACH, MEMBER | Saves; the other sees the change after a refresh | SER-26 |
| COL-34 | Cancel session, cancel series | COACH, MEMBER | Both work for either colleague; after a refresh they're gone for the other | SES-21, SER-12 |
| COL-35 | Resend invite, resend series invite | COACH, MEMBER | Both offered and succeed | SES-24, SER-14 |
| COL-36 | Join with transcription, stop recording | COACH, MEMBER | Both get the recording controls (either participant may record, both kinds) | TRN-18 to TRN-20 |
| COL-37 | Delete the other colleague's topic | COACH, MEMBER | Offered and works for both | TOP-09 |
| COL-38 | A past RC session: add or edit goals and agreements, delete actions | COACH, MEMBER | No after-session lock for either colleague | |
| COL-39 | Settings: Meetings and default session length | MEMBER | Shown: a colleague schedules, so needs both | SCHED-17 |

### 3.4a Powers stay inside the colleague relationship (`COL-3xa`)

KID is coached by COACH and a colleague of OTHER_COACH in RC2.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-30a | Add New, Schedule session; the New session **Who** list | KID | Entry points shown; Who lists OTHER_COACH only, never COACH | SES-09 |
| COL-31a | KID's coaching session: card menu, upcoming card, week grid drag | KID | Open session only; no Reschedule or drag, as before phase 4 | SES-16 |
| COL-32a | A past coaching session of KID's | KID | The after-session lock still applies | |
| COL-33a | RC2 session | KID | Reschedule, cancel, resend, recording controls; no lock | SES-15 |
| COL-34a | Actions page | KID | No My/Coachee toggle (not a coach) | ACT-01 |

### 3.5 Actions (`COL-4x`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-40 | RC session panel actions | COACH, MEMBER | Each sees every RC action, whoever is assigned | ACT-14 |
| COL-41 | Actions page, Assignment All | MEMBER | Every RC action, including ones assigned to COACH; the batch request has no `assignee` | ACT-02 |
| COL-42 | Actions page, My Actions | COACH | The batch request sends `assignee=<COACH's id>`; the board shows COACH's actions from R1 and RC alike | contract v5 section 4 |
| COL-43 | Coachee Actions view (`assignee=coachee`) | COACH | R1 actions only; no RC action; no error toast or denial page | contract v5 section 4 |
| COL-44 | Coachee Actions with the relationship filter on RC | COACH | The request has no `assignee`; no error | contract v5 section 4 |
| COL-45 | `/actions?view=coachee_actions` typed by hand | MEMBER | An empty result, not a 403 or the denial page | contract v5 section 4 |
| COL-46 | Dashboard goals card for an upcoming RC session | COACH, MEMBER | The goal progress request has no `assignee`; no error card | contract v5 section 4 |

### 3.6 Removed colleague (`COL-5x`)

**Setup:** remove MEMBER's O1 role (`ORG-04`). Restore it after the section.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-50 | New session and new series with MEMBER (stale dialog opened before the removal) | COACH | Refusal toast naming MEMBER: "{Name} is no longer in this organization". Nothing saved, no mail captured | SES-46, SER-24 |
| COL-51 | Same, COACH also an org admin | COACH as admin | The toast offers **Add back**, which opens Add existing member | SES-46 |
| COL-52 | RC card menu and upcoming card after a refresh | COACH | `scheduling_blocked_by` names MEMBER. No Reschedule or drag; Resend shown disabled with a note naming MEMBER; Cancel still works | SES-21 |
| COL-53 | New session **Who** list | COACH | MEMBER isn't offered | SES-46 |

### 3.7 Suggested actions (`COL-6x`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-60 | RC session with a completed transcript: suggestions area | COACH, MEMBER | RC's `suggests_actions` is false. No suggestions and no scan control (no spinner, no error toast) | TRN-30, TRN-31 |
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
| COL-90 | `relationship_access_manual_testing.md` rows for COACH and COACHEE (sections 3.1 to 3.8) | Unchanged answers, except DASH-08's filter group label ("Active") and ADM-05's role lines |
| COL-91 | `new_session_dialog_manual_testing.md` with R1 | Unchanged |
