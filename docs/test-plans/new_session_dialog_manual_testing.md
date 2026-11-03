# Test Plan: Manually Testing the New Session Dialog

Checks the stepped New session dialog: the shared StepDialog shell, schedule mode step by step (Who, When, Repeat, Resolve overlap) and submit, then move mode (Reschedule). Each part names the PR it covers; run a part against that layer or anything above it in the stack.

Results go in the PR for the layer under test, not in this plan.

## 1. Prerequisites

1. Backend on `:4000` from current `main`, started with email off: `RESEND_API_KEY=` and `SESSION_REMINDER_EMAIL_TEMPLATE_ID=` both blank, so no invites go out.
2. Frontend on the branch under test, `npm run dev` on `:3000`. Log in as the coach `PW_ORG_ADMIN_LOGIN_*` from `.env.local`.
3. Seed the coach's organization with five people the coach coaches:
   - **A**: a weekly series on Tuesdays at 2:30 PM, 50 min, including next Tuesday.
   - **B**: one session today, later than now.
   - **C**: two past sessions on the same weekday and time within the last 30 days, nothing upcoming.
   - **D**: last session 45 days ago, nothing upcoming (inactive).
   - **E**: no sessions (inactive).
4. Set the profile time zone to one that differs from the machine's (for example profile America/Chicago, OS Europe/London).
5. Theme switching: avatar menu › Appearance. Run every part in **both** Light and Dark unless the case says otherwise.
6. Narrow widths: DevTools device toolbar at 375×812, plus a desktop window 899px wide.
7. Forcing an error without changing data: in Chrome DevTools open **Network**, then **Block request URL**, and block the request the case names. Remove the block afterwards.

Open the dialog from the dashboard: **Add New › Coaching session**, or **Schedule a coaching session** on the empty Upcoming card.

## 2. Part A: shell and geometry (#524, checked through the dialog)

### Case A1: desktop geometry

At 1440×900, open the dialog.

**Pass:** an 860×560 dialog centered on a dim scrim. A white rail on the left titled "New session", a light grey pane on the right, and × top-right in a 36px circle.

### Case A2: fixed size

Step Who › When › Repeat and back with the arrows.

**Pass:** the dialog never changes size, and the footer (position and arrows) stays in the same place on every step. Both arrows always show: Previous is disabled on the first step and Next on the last.

### Case A3: short window

Resize the window to 1200×520.

**Pass:** the dialog height caps at the window height minus 48px. Only the step body scrolls, and the footer stays visible.

### Case A4: closing resets

Pick a person and a date, then close with Esc. Repeat with a scrim click and with ×.

**Pass:** each one closes. Reopening starts on Who with nobody selected and inactive people hidden.

### Case A5: focus

Press Tab repeatedly, then Shift+Tab.

**Pass:** focus stays inside the dialog, with a visible focus ring on every control, and Shift+Tab reverses.

### Case A6: narrow widths

Resize to 899px wide, then 375px.

**Pass:** a full-screen step view replaces the modal, never a shrunken modal. A 56px top bar reads "New session · 1 of 3" with a close button, every control is at least 44px tall, and the footer stays pinned with a round back button and a Next pill.

### Case A7: screen reader

Open the dialog with VoiceOver on.

**Pass:** it announces a dialog named "New session". Rail rows read as steps, with their values, and the current one is announced as the current step.

## 3. Part B: Who (PR 5)

### Case B1: active people

Look at the grid.

**Pass:** A, B and C show, D and E don't. Each card has a 36px avatar, the full name and a sub-line: "Usually Tuesdays, 2:30 PM" for A, "Usually {weekday}s, {time}" for C. No card says "coachee".

### Case B2: show everyone

Click the link under the grid.

**Pass:** it reads "Show everyone (+2 inactive)". Clicking it adds D and E, faded, with "Last session {date}" and "No sessions yet". The link becomes "Hide inactive", which hides them again.

### Case B3: search

With inactive people hidden, type D's first name.

**Pass:** D appears, faded, and the Show everyone link hides while the search has text. Clearing the search brings the link back.

### Case B4: picking

Pick A.

**Pass:** A's card turns white with a 20px accent check. The rail's Who row shows a green check and A's name. The rail footer reads "Scheduling will create", then "1 session with {A's first name}" and "Google Meet link included".

### Case B5: nobody to schedule

Log in as a coach with no people in this organization and open the dialog.

**Pass:** "You don't coach anyone in this organization yet." and no empty grid.

## 4. Part C: When (PR 5)

### Case C1: prefill

Pick C, then go to When.

**Pass:** the calendar selects the next date on C's usual weekday and the time is C's usual time, with its chip selected. Pick A instead (go back to Who): the date moves to next Tuesday and no time is selected, because A's own series session is there.

### Case C2: calendar header

Look at the calendar.

**Pass:** "{Mon} {year}" on the left, no Today pill on the current month, and ‹ › as 28px circles. Past days are grey and can't be clicked, and today has an accent tint.

### Case C3: month browsing

Pick a date, go › twice, then come back.

**Pass:** a Today pill appears on other months and jumps back. The selected date is highlighted again when you return. Past months show every day as past.

### Case C4: busy dots

Compare the dots with the dashboard for this month.

**Pass:** every day with any of your sessions, with anyone and in any organization, has a 4px accent dot.

### Case C5: day tooltip

Hover a dotted day for less than a third of a second and leave. Then hover and hold.

**Pass:** no tooltip on the short hover. On the long one, a dark tooltip above the day shows "{Ddd D}" and one row per session, sorted by start, with the name and "2:30 PM–3:20 PM". It doesn't block clicking the day. No tooltip at 375px.

### Case C6: the day's sessions

Pick a day with sessions, then an empty day.

**Pass:** under the calendar, "Already on {Weekday, Month D}" and one row per session, name left and time range right. On the empty day, "Nothing else on {Weekday, Month D}."

### Case C7: time chips

Look at the chips, then change the date, the person and the duration in turn.

**Pass:** at most five chips, in time order, none overlapping a session that day. Each change recalculates them.

### Case C8: overlap

Pick B, choose today, and type B's session time into the time field.

**Pass:** the note becomes a grey pill reading "Overlaps with {B}, {range} · Use {time} instead". The footer arrows don't move, the rail adds "Resolve overlap", and the position reads "2 of 4".

### Case C9: use the next free time

Click "Use {time} instead".

**Pass:** the time changes, the pill goes back to the list, Resolve overlap leaves the rail, and the position reads "2 of 3".

### Case C10: duration

Click 45, then + twice. Then type 7 and Tab, 400 and Tab, 52 and Tab.

**Pass:** 45 selects its chip, + makes 50 (chip selected), then 55 (no chip). 7 becomes 15, 400 becomes 180, and 52 becomes 50 with its chip selected.

### Case C11: default duration

Open the dialog fresh.

**Pass:** the duration starts at your profile's default session length.

### Case C12: time zone

With prerequisite 4 set, compare the chips, busy ranges and rail summary with the dashboard rows.

**Pass:** all show profile time zone times.

## 5. Part D: Repeat (PR 5)

### Case D1: repeat options

Click each of Doesn't repeat, Weekly, Every 2 weeks and Monthly.

**Pass:** one is selected at a time, and the rail's Repeats row follows.

### Case D2: weekdays

Choose Weekly.

**Pass:** the start date's weekday is selected and can't be cleared. Other days toggle.

### Case D3: ends

Choose After 8, then On a date about four months out.

**Pass:** the rail reads "Weekly, for 8 sessions" and the footer "8 sessions with {first name}". With the date, the footer's count matches the dates the series would land on.

### Case D4: invalid ends

Enter 0 sessions, then an end date before the start.

**Pass:** one inline message each time, and the confirm is disabled.

## 6. Part E: Resolve overlap (PR 5)

### Case E1: the step

Overlap B's session (Case C8), then go to the last step.

**Pass:** "Resolve overlap", with "{B}'s session on {Ddd D} at {time} overlaps the new one. Move it to:". Day circles run Monday to Sunday of that week with past days dimmed, chips show only free 30-minute starts within 9 AM to 5 PM, and "Or keep both at {time}" sits below. The footer says "Pick a new time for {B}, or keep both." and there's no confirm yet.

### Case E2: moving

Pick another day, then a chip.

**Pass:** the rail reads "Move {B} to {Ddd D}, {time}" with a check, and the confirm appears.

### Case E3: keeping both

Click "keep both".

**Pass:** the rail reads "Keep both at {time}" with a check, and the confirm appears.

### Case E4: submit with a move

Move B's session and schedule.

**Pass:** the new session is created, B's session moves, and the toast reads "Scheduled · … · {B} moves to {Ddd D}, {time}". Both show on the dashboard without a reload.

### Case E5: the move fails

Block `PUT /coaching_sessions/*` and schedule with a move.

**Pass:** the new session is still created and confirmed, and an error toast says B's session didn't move. B's session stays where it was.

### Case E6: someone else's session

Overlap a session where you're the coachee.

**Pass:** no day circles or chips, only "Keep both at {time}".

### Case E7: later clashes (known limit)

Make a weekly series whose third session clashes but whose first doesn't.

**Pass (for now):** no overlap is flagged and the series is created. This records a known limit, so a later fix flips this case.

## 7. Part F: submit (PR 5)

### Case F1: one session

Schedule a single session with no overlap.

**Pass:** the 44px confirm reads "Schedule session". Enter on the last step submits it, but not while typing in the time field. The toast reads "Scheduled · {name} · {Weekday, Month D} · {time} · {n} min", the dialog closes and the dashboard updates.

### Case F2: a series

Schedule Weekly, after 8.

**Pass:** the confirm reads "Schedule 8 sessions". All 8 appear, and the series shows under the session's series actions.

### Case F3: double click

Double-click the confirm.

**Pass:** exactly one session or series is created.

### Case F4: errors

Try offline (block all requests), with Google disconnected (revoke it in Settings first), and in an archived organization.

**Pass:** one-line toasts: "Couldn't create the session · Check your connection and try again", then "Google Meet is disconnected · Reconnect it in Settings" with a redirect to Settings, then the archived-organization message. On the retryable ones the dialog stays open with your choices.

### Case F5: meeting line

Look at the rail footer with Google connected, Zoom connected, and neither.

**Pass:** "Google Meet link included", "Zoom link included", and no line.

## 8. Part G: move mode (PR 6)

### Case G1: opening

On the dashboard, open a session row's menu › Reschedule, then the Upcoming card's Reschedule.

**Pass:** each opens "Reschedule session" for that session. The rail shows the person's avatar and name and "Currently {Ddd, Mmm D, h:mm A}". There's no Who step, the position reads "1 of 1", and the calendar, time and duration hold the session's current values.

### Case G2: no change yet

Look at the footer before changing anything.

**Pass:** "Pick a new date or time." and no confirm. The session's own day doesn't count it as busy, and its own time doesn't overlap.

### Case G3: moving

Pick another free day, keep the time, and confirm.

**Pass:** the confirm reads "Reschedule session". The toast reads "Rescheduled · {first name} to {Weekday, Month D}, {time}". The row moves without a reload. Open the session: it's the same session, with its notes and topics.

### Case G4: duration only

Change only the duration and confirm.

**Pass:** the session keeps its time and takes the new length.

### Case G5: overlap

Move onto another session you coach, then resolve by moving that one.

**Pass:** "1 of 2", then Resolve overlap as in Part E. The toast ends "· {name} moves to {Ddd D}, {time}", and both sessions show in their new places.

### Case G6: a series session

Reschedule one session of a weekly series.

**Pass:** only that session moves; the series' other sessions stay put. (Moving "this and following" comes later.)

### Case G7: errors

Block `PUT /coaching_sessions/*` and confirm.

**Pass:** "Couldn't update the session · Check your connection and try again", and the dialog stays open with your choices.

### Case G8: who can reschedule

Look at past sessions, and log in as the coachee.

**Pass:** neither shows Reschedule.

## 9. Part H: copy and theme sweep (PR 5, PR 6)

### Case H1: copy

Read every string in the dialog, in both modes.

**Pass:** "session", never "call"; "series", never "term"; "person" or "people", never "coachee". No em dashes, and no limits or ids.

### Case H2: dark mode

Go through every step in Dark.

**Pass:** the rail's current row, rail border, scrim, tooltip and toast use the dark tokens, with no white flashes. The tooltip is inverted like the toast.

### Case H3: reduced motion

Turn on reduced motion in the OS.

**Pass:** no open or close animation.
