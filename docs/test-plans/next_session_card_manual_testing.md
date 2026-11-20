# Test Plan: Manually Testing Today's Briefing and the Next Session Card

This plan checks the dashboard's Today's Briefing panel, the Next session card beside the goals card, and the shared "actions due" and overdue rules they use. The briefing replaces the "Welcome" header, Add New and the Upcoming session card.

Results go in the PR, not in this plan.

Most cases are also automated: see the Test coverage map in `docs/implementation-plans/next-session-card.md`. This plan is the real-backend pass on top of them. Cases the automated tests can't cover are real data, the visual match, a screen reader, a real phone, and 9.3.

## 1. Prerequisites

1. **Backend:** run `main` on `:4000` with email off: `RESEND_API_KEY=` and `SESSION_REMINDER_EMAIL_TEMPLATE_ID=` both blank. No backend branch is needed.
2. **Frontend:** check out the branch under test and run `npm run dev` on `:3000`.
3. **Logins** (`PW_*_LOGIN_*` in `.env.local`). Clear cookies and localStorage between logins.
   - **Coach:** coaches four or more people, and can schedule sessions.
   - **Coachee only:** has one coach and coaches nobody.
4. **Seed the coach's current organization** relative to the current week (Monday to Sunday in the coach's profile time zone). Set the times when you run each case, so the one under test is the next session.

   | Person | Sessions | Content |
   | --- | --- | --- |
   | **A** | One session **today**, starting 30 minutes from when you run the case. Also one earlier session last week | 2 topics on today's session; 2 goals linked; last week's session has 1 agreement |
   | **A** | Actions from last week's session | One not started and due yesterday (overdue); one completed and due yesterday; one in progress and due tomorrow |
   | **B** | One session **today**, 3 hours from now. No earlier session ever | No topics, no goals, no actions |
   | **C** | One session **tomorrow** at 10:00 AM. One earlier session with C last week | 1 topic; one action due yesterday |
   | **G** | Two sessions **today**: one at 9:00 AM (already over) and one later today. One more session with G last week | One action created at today's 9:00 AM session, due today |
   | **D** | One session on a **later day this week**, not tomorrow | |
   | **E** | One session **next Monday** | |
   | **H** | One session **next Monday** at 9:00 AM, and nothing else | For the Sunday case |

   - Run "which session" cases by moving or cancelling earlier sessions so the one under test comes next.
   - Use the week grid's card menu to cancel, and restore by rescheduling. Or seed per case.
5. **Time zone:** set the profile time zone to one that differs from the machine's, for example profile America/Chicago and OS Europe/London.
6. **Theme:** run every visual case in both Light and Dark (avatar menu › Appearance).
7. **Widths:** desktop at 1440×900, 768px wide (the stacking point), and a phone at 360×740.
8. **Forcing an error or slow load:** DevTools › Network › Block request URL, or throttle to Slow 3G. Remove the block afterwards.

## 2. The panel

### Case 2.1: header

Open the dashboard as the coach.

**Pass:**
- A white panel with a 1px border, 16px corners and no shadow. Inside it:
  - "Today's Briefing" in large regular-weight type;
  - under it, today's date alone, for example "Thursday, November 19".
- The date follows the profile time zone. Near midnight, compare it with the machine clock: the panel shows the profile zone's date.
- There is no "Welcome {name}!", no "Today is", and no Add New button anywhere on the dashboard.

### Case 2.2: layout

**Pass:**
- The Next session card (left, about 300 to 340px wide) and the goals card (the rest) sit side by side inside the panel, with a 16px gap. The two cards are the same height.
- At 768px and narrower, they stack, with the Next session card first.
- The week panel below is its own panel and is unchanged.

### Case 2.3: entry points still reachable

**Pass:**
- Scheduling: the week panel's "Schedule session" button opens the New session dialog.
- Adding a member: the Members page's add flow works as an admin.

## 3. Which session

### Case 3.1: today's next session

A is the next session today.

**Pass:** the card shows A, not B, even though both are today.

### Case 3.2: past sessions skip

Let A's session end, or move it into the past.

**Pass:**
- Within 30 seconds, without a reload, the card moves on to B.
- A session that has started but not ended still shows (Case 4.2).

### Case 3.3: later this week

Cancel or move today's remaining sessions.

**Pass:** the card shows C, "Tomorrow with C…". With C moved too, it shows D with its weekday name.

### Case 3.4: not next week

Leave only E (next Monday) ahead.

**Pass:** the card shows the empty state (Case 7.1), not E. This applies Monday to Saturday; on Sunday, see Case 3.4a.

### Case 3.4a: Sunday looks ahead to Monday

On a Sunday (or with the browser clock moved to Sunday evening), leave only H ahead.

**Pass:**
- The card reads "Tomorrow with {H} at 9:00 AM", with "Mon, {date}" below it.
- The goals card follows.
- With H moved to Tuesday, the card shows "No more sessions this week."

### Case 3.5: the goals card follows

Repeat Cases 3.1 and 3.3.

**Pass:**
- The goals card always describes the same session as the Next session card, including on a day with nothing left today.
- In DevTools › Network, only one request for this week's sessions is made, with `include=relationship,series,topics,goal`. There's no separate request for "today's" sessions with `include=relationship,organization,goal`.

## 4. Headline and when line

### Case 4.1: starting soon

A starts in 30 minutes.

**Pass:**
- Label "Next session" in sentence case. No uppercase or tracked label.
- Headline "Today with {A's first name} at {time}", with the time in the profile zone and no zone abbreviation.
- The headline wraps onto more lines rather than truncating.
- A 40px avatar at the top right, in the same tone as A's avatar elsewhere in the app.
- Under the headline, in brand color with a pulsing dot: "Starts in 30 mins".
- The line counts down without a reload, and reads "Starts in 1 min" at one minute.

### Case 4.2: under way

Wait until A starts.

**Pass:** "Currently under way", in brand color with the pulsing dot.

### Case 4.3: later today

B is next, 3 hours away.

**Pass:**
- "Starts in 3 h", muted, with no dot.
- At 2 hours 45 minutes away it reads "Starts in 2 h 45 mins".

### Case 4.4: another day

**Pass:**
- C reads "Tomorrow with {C} at 10:00 AM", with the date "Fri, Nov 20" (that date's form) muted below.
- D reads "{Weekday} with {D} at {time}".

### Case 4.5: session title, duration, Reschedule

**Pass:**
- The card shows no session title, no duration and no Reschedule button.
- The button reads "Open session", even when the session is under way. Rescheduling still works from the week grid card.

## 5. At a glance

### Case 5.1: open by default, folds from its header only

**Pass:**
- "At a glance" is open on load.
- Clicking its header row folds and unfolds the rows, and the chevron flips.
- With a screen reader or DevTools › Accessibility, the header button reports expanded or collapsed.
- Clicking elsewhere on the card does not fold it.
- After a reload it is open again.

### Case 5.2: values for A

**Pass:**
- Topics "2".
- Actions due shows "1 overdue" in the warning (amber) color, at medium weight. The completed past-due action is not counted as overdue.
- Agreements from last session shows a chevron only.
- Goals "2 active".

### Case 5.3: values for B

**Pass:**
- Topics "None yet", Actions due "None", Goals "None yet".
- There's no "Agreements from last session" row, because B has no earlier session.

### Case 5.4: Actions due matches the Due tab

For A and for C, then for G (make G's later session the next one):
1. Note the Actions due value.
2. Click its row.

**Pass:**
- The session page opens with the Actions panel on the **Due** tab.
- The Due tab lists exactly as many actions as the card's count (for "1 overdue", the total count shown on the tab).
- Repeat with G's later session next. The previous session is the one at 9:00 AM today, not last week's: "Agreements from last session" opens the 9:00 AM session, and the card count still equals the Due tab.

### Case 5.5: row links

**Pass:**
- Topics opens the session page on Topics.
- Goals opens it on Goals.
- Agreements from last session opens **last week's** session on Agreements.
- Open session opens the session page with no panel parameter.

## 6. Overdue everywhere

### Case 6.1: Actions page

On the Actions page, find A's completed action and an on-hold action that are past due.

**Pass:**
- Neither is marked or counted overdue.
- A's not-started past-due action is overdue and sorts first, as before.

### Case 6.2: action cards

On the session page's Actions panel, look at the same actions.

**Pass:** "Overdue" in amber only on open (not started or in progress) actions. On hold reads as paused.

## 7. Empty, loading, error

### Case 7.1: no more sessions this week

Leave nothing ahead this week, as the coach.

**Pass:**
- The card keeps its tinted (hero) look and the "Next session" label, then shows "No more sessions this week." and "Check back on Monday."
- A "Schedule a session" grey pill at the bottom opens the New session dialog.
- The card keeps its height, so nothing below jumps.

### Case 7.2: empty as a coachee

Repeat Case 7.1 as the coachee.

**Pass:** the same copy, with no "Schedule a session" button.

### Case 7.3: loading

Throttle to Slow 3G and reload.

**Pass:**
- The card shows static grey blocks shaped like the result (label, headline, rows, a pill), on the tinted card, at full height.
- There's no spinner and no pulsing.
- The panel doesn't change height when data arrives.

### Case 7.4: next session error

Block the user's `coaching_sessions` request and reload.

**Pass:**
- The card turns plain (no tint) and keeps the "Next session" label.
- A round red-tinted badge holds a red alert icon, with "Couldn't load your next session" next to it.
- A grey "Try again" pill sits at the bottom.
- Unblock the request and click Try again: the card loads without a reload.
- The error text and icon are clearly readable in Dark.

### Case 7.5: goals card error

Block the `goal_progress` request.

**Pass:**
- The goals card shows the same error body, reading "Couldn't load your goals", with Try again.
- No "Please refresh" text appears.
- Unblock the request and click Try again: the goals load.

## 8. Theme, phone, keyboard

### Case 8.1: Dark

**Pass:**
- Everything above holds in Dark.
- The hero card has its dark wash. Text, the warning value and the error badge all stay readable.
- No light-only colors show through.

### Case 8.2: phone

At 360×740:

**Pass:**
- No horizontal scroll.
- The cards stack, with the Next session card first.
- Each At a glance row, its header and the Open session pill are at least 44px tall.
- The headline wraps cleanly.

### Case 8.3: keyboard

**Pass:**
- Tab reaches the At a glance header, each row and Open session, in that order.
- Enter or Space on the header folds it.
- Enter on a row follows its link.
- Focus rings are visible.

## 9. Regression

1. The week panel's grid, paging, card menu, drag to move and Schedule session behave as before. Run `week_grid_manual_testing.md` Cases 1.1 to 1.3 and 2.1.
2. The header's Join session menu still lists today's sessions.
3. Opening a session from the card loads its Actions panel immediately, with no blank flash. Its data was already fetched for the card.
