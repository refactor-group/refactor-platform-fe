# Test Plan: Relationship Access in the UI (Frontend)

Companion to the backend access matrix at
`refactor-platform-rs/docs/test-plans/relationship_access_manual_testing.md` (rs#399).

The backend plan records what every route answers per caller. This plan records what each
viewer **sees and can use** in the browser, and links each row to the backend rows it relies
on. Run it in Playwright after rs#399 phases 3 and 6, and whenever a role rule changes.

It does not re-run the backend matrix. Status codes are checked here only where the UI must
handle a refusal.

Record results wherever the run is reported (PR, commit body, coordination board). Do not
write them into this file.

---

## 1. Prerequisites

- Frontend on `http://localhost:3000`, backend on `http://localhost:4000`.
- **Fixture:** the backend plan's cast and rows (its sections 2 and 3): O1, O2, `COACH`, `COACHEE`,
  `OTHER_COACH`, `MEMBER`, `ADMIN`, `OUTSIDER`, `SUPER`, `REMOVED`, R1–R3, S1–S3, SR1, A1–A6, G1,
  G2, AG1, T1, T2, SG1, SG2. Put `kumquat` in bodies and titles, as that plan says.
- **Extra for this plan:**
  - S1 is today, at least an hour away, so the after-session lock rows can run on a past
    session `SP1` in R1.
  - SG1 and SG2 need a transcription on S1 (backend `TRN` prerequisites).
  - Section 3.10 has its own setup.
- **Email:** leave Resend unconfigured (`RESEND_API_KEY` unset). Several rows create, move or cancel
  sessions.

### Harness warnings

Each of these has produced a false result before:

1. **Prove the response recorder works before trusting a clean run.** Record backend responses with
   `page.on('response')` registered in the same `browser_run_code` call that navigates, then fetch a
   known 404 (`GET /notes/<random uuid>`) and confirm it is recorded. A listener left over from an
   earlier call can silently record nothing.
2. **Log in through the form, and wait for the page to settle first** (`waitForLoadState('networkidle')`).
   A click before hydration does nothing, and the test then times out on the dashboard URL.
3. **Switch users with `clearCookies()` plus `localStorage.clear()`.** The auth store is persisted;
   cookies alone leave the previous viewer's role in place.
4. **Drive another user's changes with curl, not `page.request`.** It shares the page's cookie jar
   and replaces the session under test. Use the backend plan's `login` and `call` helpers.
5. **Credentials live in `.env.local` or the backend plan's fixture.** Never paste them into this
   document.

---

## 2. How to read the tables

- **Viewer** is the logged-in fixture user. Org-wide rules (`isACoach`) count a user as a coach
  if they coach **anyone** in the selected org.
- **Expected** describes what is visible or usable. "Hidden" means absent from the DOM, not
  disabled.
- **BE** lists the backend rows the control calls. A UI row passes only if its BE rows still hold.
- **Generic denial page:** "Access Denied" is the ForbiddenError view, with **Go Back** and
  **Go to Dashboard**.

---

## 3. Matrix

### 3.1 Dashboard (`DASH`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| DASH-01 | Header **Add New** | COACH | Shown, with **Coaching session** only | SES-09 |
| DASH-02 | Header **Add New** | ADMIN | Shown, with **Organization member** only | ORG-01 |
| DASH-03 | Header **Add New** | COACHEE, MEMBER | Hidden | SES-10 |
| DASH-04 | Upcoming card, no session today | COACH | "Your day is clear. Schedule a session to get started." plus **Schedule a coaching session** | SES-27 |
| DASH-05 | Upcoming card, no session today | COACHEE | "…Your coach will schedule your next session.", no button | SES-28 |
| DASH-06 | Upcoming card for S1: **Reschedule** | COACH, COACHEE | COACH: shown. COACHEE: hidden | SES-15, SES-16 |
| DASH-07 | Goals card for S1 | COACH: "{Coachee}'s active goals"; COACHEE: "Your active goals" | Both list G1 | GOAL-19 |
| DASH-08 | Week grid: **Schedule session**, person filter, empty-day **Schedule on {day}** | COACH, COACHEE | COACH: shown; the filter lists only people COACH coaches. COACHEE: hidden | SES-09, REL-01 |
| DASH-09 | Week grid card S1: drag to move, phone **Move** | COACH, COACHEE | COACH: movable; a move sends `PUT /coaching_sessions/S1`. COACHEE: not movable | SES-15, SES-16 |
| DASH-10 | Card menu on S1 (right-click or long press) | COACH | Open session, Reschedule…, Share link, Resend invite, Cancel session… | SES-15, SES-21, SES-24 |
| DASH-11 | Card menu on an SR1 session | COACH | Also View series, Edit series…, Resend series invite, Cancel series… | SER-06, SER-10, SER-12, SER-14 |
| DASH-12 | Card menu on S1 or SR1 sessions | COACHEE | **Open session** only | SES-16, SER-09 |
| DASH-13 | Card menu on past session SP1 | COACH | Open session and **Remove session…** only | SES-21 |
| DASH-14 | Week grid with the week read failing (block `/users/*/coaching_sessions` with `page.route`) | COACH | **Schedule session** visible but disabled, no card is movable, no empty-day button | |

### 3.2 New session dialog (`NEW`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| NEW-01 | Who list | COACH | COACHEE and REMOVED: the people COACH coaches in the selected org, removed members included | REL-01, SES-09 |
| NEW-02 | Dialog entry points | COACHEE | None: Add New, Schedule session and Schedule on {day} are all hidden (DASH-03, DASH-08) | SES-10 |
| NEW-04 | Clash step: one overlapping session the viewer coaches | COACH | Day circles and time chips to move the other session, plus "Or keep both at …" | SES-15 |
| NEW-06 | Submit | COACH | `POST /coaching_sessions` (or `/coaching_session_series` when repeating) returns 200, and the session appears on the grid | SES-09, SER-01 |

### 3.3 Session page header (`HDR`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| HDR-01 | Title edit | COACH, COACHEE | Both can edit; the change persists after reload | SES-19 |
| HDR-02 | Join, no meeting URL | COACH, COACHEE | Disabled icon, tooltip "Set up a Google Meet link in Settings → Integrations" | |
| HDR-03 | Join, with URL, idle | COACH | Dropdown: **Join with transcription**, **Join without transcription** | TRN-19 |
| HDR-04 | Join, with URL, idle | COACHEE | Plain camera button that opens the URL; no recording controls | MEET-04 |
| HDR-05 | Join while recording | COACH, COACHEE | COACH: **Open meeting**, **Stop recording** (confirm first). COACHEE: camera button with a red recording dot | TRN-18, TRN-20 |
| HDR-06 | Transcript panel and download | COACH, COACHEE | Both see and download TR1 | TRN-01, TRN-03 |

### 3.4 Topics (`TOPIC`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| TOPIC-01 | Add, edit any topic, reorder, Discussed, Defer | COACH, COACHEE | All usable on S1 | TOP-03, TOP-05 to TOP-07, TOP-16 |
| TOPIC-02 | Priority select | COACHEE | Editable | TOP-13 |
| TOPIC-03 | Priority | COACH | Static chip: the label, or "Priority Not Set" | TOP-14 |
| TOPIC-04 | **Delete topic** on T1 (authored by COACH) | COACH, COACHEE | COACH: shown. COACHEE: hidden | TOP-09, TOP-11 |
| TOPIC-05 | **Delete topic** on T2 (authored by COACHEE) | COACH, COACHEE | Shown to both | TOP-09, TOP-10 |
| TOPIC-06 | Add topic on past session SP1 | COACH, COACHEE | Field and button visible but disabled for both | |
| TOPIC-07 | Live update | COACHEE adds a topic | It appears in COACH's open S1 tab without a reload | TOP-03 |

### 3.5 Session panel: goals, agreements, actions (`PANEL`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| PANEL-01 | Goals: add, link, unlink, edit | COACH, COACHEE on S1 | All usable. The link picker lists only R1 goals: G1, never G2 | GOAL-06, GOAL-10, GOAL-13, GOAL-14, GOAL-27 |
| PANEL-02 | Agreements: add, edit, delete | COACH, COACHEE on S1 | All usable | AGR-05 to AGR-07 |
| PANEL-03 | Actions: add, edit body, status, due date, delete | COACH, COACHEE on S1 | All usable | ACT-28 to ACT-31 |
| PANEL-04 | Action assignee picker | COACH, COACHEE | Offers exactly COACH and COACHEE | ACT-36 |
| PANEL-05 | Action goal picker | COACH, COACHEE | Lists only R1 goals | GOAL-27 |
| PANEL-06 | Actions list on S1 | COACHEE | A1, A2 and A3, including coach-assigned A1 | ACT-14, ACT-15, ACT-18 |
| PANEL-07 | After-session lock on SP1 | COACHEE | Panel **Add** hidden; goal Edit/unlink, agreement Edit/Delete and action Delete hidden. Action status, due date, assignee and body still editable | |
| PANEL-08 | After-session lock on SP1 | COACH | Nothing hidden | |
| PANEL-09 | Brand-new session, no note yet | COACH, COACHEE | Editor mounts, no error toast, no backend response ≥ 400 | JWT-01 |
| PANEL-10 | Live update | COACH creates an action assigned to COACH | It appears in COACHEE's open S1 panel without a reload | SSE-02 |

### 3.6 Suggested actions (`SUG`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| SUG-01 | SG1 (coach-only): Accept, Edit, Dismiss | COACH | Shown and usable | TRN-11, TRN-15 |
| SUG-02 | SG1 | COACHEE | No buttons; note "Only {coach} can accept or edit this action." | TRN-12, TRN-16 |
| SUG-03 | SG2: Accept, Edit, Dismiss | COACHEE | Shown. In Edit, the coach assignee is disabled with "Only your coach can assign an action to themselves." | TRN-13 |
| SUG-04 | Dismissed SG1 | COACHEE | "Only {coach} can restore it", no **Restore** | TRN-16 |
| SUG-05 | Scan transcript | COACH, COACHEE | Both can start a scan | TRN-09 |

### 3.7 Actions page (`ACTS`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| ACTS-01 | **My Actions** / **Coachee Actions** toggle | COACH, COACHEE | COACH: shown. COACHEE: hidden | ACT-01, ACT-06 |
| ACTS-02 | Both toggle views, Assignment set to All | COACH | Only R1 and R3 actions (A1–A3, A6); never A4 or A5 | ACT-01 |
| ACTS-03 | Assignment set to All | COACHEE | A2, A3 and A5. **Not A1 or A4** (see INT-01) | ACT-02 |
| ACTS-04 | Relationship filter | COACHEE | Lists only R1 and R2. Picking R1 shows A2 and A3 | ACT-08 |
| ACTS-05 | Kanban drag, edit, delete on a listed card | COACH, COACHEE | Usable on every card shown | ACT-29 to ACT-31 |
| ACTS-06 | `/actions?view=coachee_actions` typed by hand | COACHEE who coaches no one | "Actions Access Denied" page, no crash | ACT-06 |

### 3.8 Members and admin (`ADM`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| ADM-01 | User menu **Members** | all | Shown to ADMIN and SUPER only | |
| ADM-02 | User menu **Organizations** | all | Shown to SUPER only | |
| ADM-03 | User menu **Settings** | all | Shown to COACH and OTHER_COACH only | |
| ADM-04 | `/organizations/O1/members` | COACH, COACHEE, MEMBER | 404 page | REL-07 |
| ADM-05 | Members page: each card's "Roles:" line shows Coach / Coachee from R1–R3 | ADMIN, SUPER | Lists every relationship pairing | REL-05, REL-06 |
| ADM-06 | Member card **⋯**: Assign Coach / Coachee, Grant/Revoke admin, Remove, Delete | ADMIN | Shown on others, hidden on own card | REL-15, ORG-03 to ORG-07 |
| ADM-07 | `/admin/organizations` | anyone but SUPER | 404 page | |
| ADM-08 | `/members/{other id}/profile` | any | "You can only update your own profile." | |

### 3.9 Non-participants (`DENY`)

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| DENY-01 | Open the S1 URL | MEMBER, OTHER_COACH, ADMIN, SUPER, OUTSIDER | "Coaching Session Access Denied" page, no toast, no crash. Every backend response is 403 (session, collab token, recording, transcriptions) | SES-05, JWT-02, TRN-21 |
| DENY-02 | **Go to Dashboard** from DENY-01 | same | Lands on `/dashboard` for the viewer's own org | |
| DENY-03 | Search for `kumquat` | MEMBER, ADMIN | No hits from R1–R3 | SRCH-04 |
| DENY-04 | Search for `kumquat` | SUPER | A1–A6 | SRCH-05 |
| DENY-05 | Join session menu | MEMBER | No R1 entries | SES-32 |

### 3.10 Removed members (`MEM`, phase M)

Phase M makes a user's own lists leave out relationships in orgs they no longer belong to (backend rows
marked `[membership]`).

**Most of the FE was already scoped this way:**
- The org switcher lists only current memberships.
- The dashboard, week grid and Actions page read with the selected org.

**Only two FE reads use the unscoped self lists:**
- the New session dialog's history and busy times;
- the Actions page's session context.

**Setup** (destructive, run last or on disposable data):
1. Give COACH a `User` role in O2 (`ORG-03` against O2).
2. Create relationship R5 (COACH to OUTSIDER, O2) and a session S5 at a different hour on S1's day.
3. Then remove COACH from O1 (`ORG-04` with COACH's id).
4. Separately, use REMOVED, who holds no role anywhere.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| MEM-01 | Org switcher | COACH (removed from O1) | O2 only. A persisted O1 selection is replaced on load | ORG-04 |
| MEM-02 | Dashboard and week grid on S1's day | COACH | S5 only; no S1, S3 or SR1 sessions | SES-27, SES-30 |
| MEM-03 | New session dialog with OUTSIDER, at S1's time | COACH | **No clash** with S1, since S1 is in the left org. At S5's time the clash step still appears | SES-27, SES-30 |
| MEM-04 | Actions page | COACH | Only R5 actions; nothing from R1 or R3 | ACT-20, ACT-21 |
| MEM-05 | Open the S1 URL | COACH | "Coaching Session Access Denied" page | SES-05 |
| MEM-06 | Search for `kumquat` | COACH | No R1 or R3 hits | SRCH-06 |
| MEM-07 | Log in | REMOVED (no org) | Toast "Your account has no access yet · Contact support". The dashboard shows no sessions | REL-17, SES-30, ACT-21 |
| MEM-08 | Open the S3 URL | REMOVED | "Coaching Session Access Denied" page | SES-06 |

The phase M email rules (MAIL-01, MAIL-03 to MAIL-09, MAIL-11) have no UI surface; the backend plan covers them.

### 3.11 Confirmed as intended (`INT`)

Two behaviors look inconsistent but are intended. These rows pin them so nobody "fixes" one.

| ID | Control | Viewer | Expected | BE |
|---|---|---|---|---|
| INT-01 | Coachee sees only own and unassigned actions on the **Actions page**, but every action of the session elsewhere | COACHEE | **Actions page:** A2, A3, A5; never A1 or A4. **S1 panel:** A1, A2, A3. **Search:** A1–A5. A live `action_created` for a coach-assigned action shows in the panel | ACT-02, ACT-08, ACT-15, ACT-18, SRCH-02, SSE-02 |
| INT-02 | Org admins see relationships but not their content | ADMIN, SUPER | **Members page:** the R1–R3 pairings (ADM-05). **The S1 URL:** "Coaching Session Access Denied" (DENY-01) | REL-05, REL-06, REL-09, SES-05 |

### 3.12 Known UI gaps (`GAP`)

Recorded as they are today. Each is a UI inconsistency, not an access hole: the backend decides
every write. Re-check them when the rule they touch changes.

| ID | Behavior | Viewer | Expected today | BE | Issue |
|---|---|---|---|---|---|
| GAP-01 | The note editor's "Add as …" selection bubble ignores the after-session lock | COACHEE on SP1 | The agreement, action or goal add form opens and saves, although the panel's **Add** is hidden | AGR-05, ACT-28 | [#545](https://github.com/refactor-group/refactor-platform-fe/issues/545) |
| GAP-02 | The topic delete toast's **Undo** is shown to the coach after deleting T2 | COACH | Undo returns 404, the toast "Couldn't restore the topic" appears, and T2 stays deleted | TOP-18 | [#546](https://github.com/refactor-group/refactor-platform-fe/issues/546) |
| GAP-03 | Session panel when the relationship read fails | any participant | The viewer is treated as coachee: no rating, no deleting others' topics, coachee Join | | [#547](https://github.com/refactor-group/refactor-platform-fe/issues/547) |
