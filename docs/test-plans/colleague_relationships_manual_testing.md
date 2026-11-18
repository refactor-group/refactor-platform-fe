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

- Section 3.10 (and COL-28, COL-29, COL-41, COL-47) need fe#565 and the rs#517 backend.
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
| COL-03 | Pair COACH with MEMBER as **Coach** or **Coachee**, while RC exists | ADMIN | The picker shows MEMBER dimmed, "Already Coach's colleague", not pickable. Forcing the POST (stale dialog: pick MEMBER, then create RC with curl, then **Pair them**) gets the toast "{Coach} and {Member} are already colleagues"; the dialog stays open, MEMBER turns dimmed and **Pair them** is disabled; nothing new is listed | KIND-13 |
| COL-04 | Pair COACH with COACHEE as **Colleague**, while R1 exists | ADMIN | Same as COL-03, against the coaching relationship. The toast reads "{Coach} is already {Coachee}'s coach" | KIND-12 |
| COL-05 | Pair COACHEE with COACH as **Coach** (the other way round from R1) | ADMIN | Allowed, as before phase 4. Delete it afterwards | KIND-14 |
| COL-06 | Pair two people as **Colleague** through a stale dialog after the same pairing was made elsewhere | ADMIN | Succeeds with the existing relationship's `id` (no refusal, no duplicate) and the "are now colleagues" toast | KIND-11 |
| COL-07 | The **(i)** on each role card | ADMIN | Opens a popover beside the card without choosing it. Coachee: "Meets with their coach, who schedules their sessions. Sees only the actions assigned to them." Coach: "Schedules and runs sessions with their coachee, and sees every action in the relationship." Colleague: "Works with a peer as an equal. Either of them can schedule sessions, and both see every action they share." | — |

### 3.2 Adding members with a relationship (`COL-1x`)

Members page **Add Member**: the **New person** and **Has an account** chips. COL-14 re-adds REMOVED; remove them again before COL-15.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-10 | Add a new member, Relationship **None** | ADMIN | Body has no `relationship`. The member appears with no relationship | ORG-01 |
| COL-11 | Add a new member, Relationship **Coachee**, with COACH | ADMIN | Body has `relationship: {with_user_id: COACH, kind: "coaching"}`, no `coach_id`. COACH coaches the new member | ORG-01 |
| COL-12 | Add a new member, Relationship **Colleague**, with COACH | ADMIN | Body has `kind: "colleague"`. The new member and COACH are listed as colleagues | KIND-15 |
| COL-13 | Add a new member as **Colleague** with someone not in O1 (OUTSIDER, through a stale picker or `page.route` rewrite) | ADMIN | The refusal toast shows and the dialog stays open. After a reload, the members list has no user with that email and COACH has no new relationship | KIND-18 |
| COL-14 | Add existing member (a former member with no relationship to COACH), Relationship **Colleague**, with COACH | ADMIN | Body goes to `…/users/{id}/role` with `relationship: {with_user_id, kind: "colleague"}`. Member and colleague relationship both appear | KIND-16 |
| COL-15 | Add existing member REMOVED as **Colleague** with COACH, while R3 exists | ADMIN | The With step shows COACH dimmed, "Already Removed's coach", not pickable. Forcing it (stale dialog or `page.route` rewrite) gets the toast "{Coach} is already {Removed}'s coach" and the dialog stays open. After a reload, REMOVED is not listed as a member and has no new relationship | KIND-17 |
| COL-16 | **Has an account** lookups: OUTSIDER (only in O2), REMOVED (a former member), MEMBER (a current one) | ADMIN | OUTSIDER: "No user found with that email." (an admin can't see accounts outside their organizations). REMOVED: found, shown as a card with **Clear**. MEMBER: "They're already a member of this organization", and **Next** stays disabled | ORG-01 |
| COL-17 | Step 1, the rail and the summary | ADMIN | Step 1 reads "New member details" in both chips. On step 1, Access and Relationship are not ticked; each ticks once passed or once something other than its default is chosen. The rail's **Adding** block reads "{Name} to {O1} as a member", then ", coached by {Coach}" or ", {Coach}'s colleague" | — |
| COL-18 | The **(i)** on the Access and Relationship cards | ADMIN | Member: "Can be paired with people in this organization and work with them. Can't add or pair members." Admin: "Everything a member can do, plus adding, removing and pairing members in this organization." Coachee and Colleague as in COL-07; None has no (i) | — |
| COL-19 | New person's **Time zone**, and its (i) | ADMIN | Starts on the admin's own zone; the (i) reads "Yours unless you pick another. They can change it later." Picking another zone sends it as `timezone` in the create body, and the new account has it (their profile shows it) | ORG-01 |

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
| COL-28 | Session page header presence dots, with the other colleague in a second browser context | Each dot follows its own person: yours turns green when you open the page, the other's only while they're on it, and grey again within a few seconds of them leaving. Run it as COACH and as MEMBER, then the same on an R1 session (coach and coachee dots) | |
| COL-29 | Header **Join session** switcher, per organization | Shown to anyone who coaches or is a colleague there, even with one relationship: MEMBER (colleague of one), COACH. Never to someone only ever coached there (COACHEE), however many coaches they have, nor to ADMIN with no relationship | |

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
| COL-36b | One bot per session (needs the phase 4b backend): COACH clicks **Join with transcription**; then MEMBER, in a second context, does too before their button refreshes | COACH, MEMBER | Only one Refactor Coach bot joins. MEMBER's meeting opens with no error toast; their POST gets 409 `recording_already_active`, and their button then shows the active view (recording dot, Stop) | 4b |
| COL-36c | MEMBER opens the session after COACH started transcription, and stays on it while it starts | MEMBER | The button shows the active view, with no **Join with transcription**, from the claim (status pending, no bot yet) on; it changes live on `meeting_recording_updated` without a refresh | 4b |
| COL-36d | Any other start failure: archive the organization after the session page loads (409 `organization_archived`), or stub the POST with a 500 | COACH | Still "Couldn't start transcription", and the meeting still opens; only `recording_already_active` is silent | 4b |
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
| COL-41 | Actions page, Assignment **Assigned**, **Unassigned**, **All** (seed RC with one action each: MEMBER only, COACH only, both, nobody) | MEMBER | Assigned: MEMBER-only and both, never COACH-only; the request sends `assignee=<MEMBER's id>&assignee_filter=assigned`. Unassigned: only the unassigned one. All: Assigned's list plus the unassigned one, from two requests (the Assigned one and `assignee_filter=unassigned`). No two options show the same list | ACT-02 |
| COL-42 | Actions page, My Actions, then Assignment All | COACH | The batch request sends `assignee=<COACH's id>`; the board shows COACH's actions from R1 and RC alike. All adds the unassigned R1 and RC actions, as in COL-41 | contract v5 section 4 |
| COL-43 | Coachee Actions view (`assignee=coachee`) | COACH | R1 actions only; no RC action; no error toast or denial page | contract v5 section 4 |
| COL-44 | Coachee Actions with the relationship filter on RC | COACH | The request has no `assignee`; no error | contract v5 section 4 |
| COL-45 | `/actions?view=coachee_actions` typed by hand | MEMBER | An empty result, not a 403 or the denial page | contract v5 section 4 |
| COL-46 | Dashboard goals card for an upcoming RC session | COACH, MEMBER | The goal progress request has no `assignee`; no error card | contract v5 section 4 |
| COL-47 | Header **Actions** badge, with COL-41's seed | MEMBER, COACH | Counts only the viewer's own open actions, shared ones included: MEMBER's badge says 2. Adding a COACH-only RC action leaves MEMBER's badge unchanged | |

### 3.6 Removed colleague (`COL-5x`)

**Setup:** remove MEMBER's O1 role (`ORG-04`). Restore it after the section.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-50 | New session and new series with MEMBER (stale dialog opened before the removal) | COACH | Refusal toast naming MEMBER: "{Name} is no longer in this organization". Nothing saved, no mail captured | SES-46, SER-24 |
| COL-51 | Same, COACH also an org admin | COACH as admin | The toast offers **Add back**, which opens Add existing member | SES-46 |
| COL-52 | RC card menu and upcoming card after a refresh | COACH | `scheduling_blocked_by` names MEMBER. No Reschedule, Resend invite or drag; the menu's note names MEMBER; Cancel still works | SES-21 |
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

### 3.10 Changing a relationship's kind (`COL-Ax`)

Needs the phase 5 backend (rs#517: `PUT …/coaching_relationships/{id}/kind`, contract
`RelationshipKindSwitch` v3). Open the dialog from a member card's ⋯ menu, **Change relationship…**,
as ADMIN. Keep the other participant in a second browser context for the live rows.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| COL-A0 | Step 1 for COACH | ADMIN | Each person COACH works with, once, named with their email and what they are to COACH ("Coach's colleague", "coached by Coach"). Someone who left is shown but can't be picked | |
| COL-A1 | Step 2, role | ADMIN | The current role is preselected and marked "(current)"; the next arrow stays disabled until another role is picked | |
| COL-A2 | Switch RC to coaching, COACH coaching MEMBER | ADMIN | Review lists the consequences in plain words ("{Name} will see N actions assigned to {Other}", who gains or loses scheduling), or "Nothing else changes for them". Nothing is saved until **Change relationship**; then the toast names both people, and both member cards update | KIND-28, KIND-29 |
| COL-A3 | Reverse R1 (the coachee becomes the coach) | ADMIN | Review reads "{Coachee} will coach {Coach}"; after confirming, the cards show the new direction | KIND-30, KIND-32 |
| COL-A4 | Refusals: a participant left (stale dialog), the pair is already related the other way, the relationship was deleted, an archived organization | ADMIN | Toasts: who left, with Add back; "{A} is already {B}'s coach" (or colleagues); "This relationship no longer exists"; "This organization is archived · It can't be changed", which closes the dialog whether it comes from the review or from confirming. Nothing changes. After "who left", the members list drops them at once, and Add back, clicked on the Members page itself, opens Add member on "Has an account", where Find locates them; re-adding works, and the URL loses `?addMember` once the dialog closes | KIND-33, KIND-36, KIND-44 |
| COL-A5 | The other participant's open tabs during COL-A2 | COACH, MEMBER | Members page, session page and Actions page update without a refresh | KIND-43 |
| COL-A6 | Mock Resend capture after COL-A2 | | Upcoming sessions' invites are resent to both, worded for the new kind | KIND-38 |

### 3.11 Regression (`COL-9x`)

| ID | Control | Expected |
|---|---|---|
| COL-90 | `relationship_access_manual_testing.md` rows for COACH and COACHEE (sections 3.1 to 3.8) | Unchanged answers, except DASH-08's filter group label ("Active") and ADM-05's role lines |
| COL-91 | `new_session_dialog_manual_testing.md` with R1 | Unchanged |
